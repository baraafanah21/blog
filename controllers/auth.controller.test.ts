import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../app";
import * as userModel from "../models/user.model";
import { generateAccessToken, generateRefreshToken } from "../utils/token";
import * as refreshTokenModel from "../models/refreshToken.model";
jest.mock("../models/user.model");

// Keep the real hashToken so the tests assert on the hash the controller
// actually stores; only the database-touching functions are replaced.
jest.mock("../models/refreshToken.model", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("node:crypto");
  return {
    hashToken: (token: string): string =>
      crypto.createHash("sha256").update(token, "utf8").digest("hex"),
    save: jest.fn(),
    findByHash: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
    rotate: jest.fn(),
  };
});

const userModelMock = userModel as jest.Mocked<typeof userModel>;
const tokenStoreMock = refreshTokenModel as jest.Mocked<
  typeof refreshTokenModel
>;

const storedRow = (
  token: string,
  overrides: Partial<refreshTokenModel.RefreshTokenRow> = {},
): refreshTokenModel.RefreshTokenRow => ({
  id: 1,
  user_id: 1,
  token_hash: refreshTokenModel.hashToken(token),
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  revoked_at: null,
  created_at: new Date(),
  ...overrides,
});

describe("Post /auth/login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("مدخلات صحيحة → 200 + توكنات", async () => {
    const password = "correctPassword";
    const password_hash = await bcrypt.hash(password, 10);
    userModelMock.findByUsername.mockResolvedValueOnce({
      id: 1,
      username: "testuser",
      password_hash,
      role: "user",
      token_version: 0,
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ username: "testuser", password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(tokenStoreMock.save).toHaveBeenCalledWith(
      1,
      refreshTokenModel.hashToken(res.body.refreshToken),
      expect.any(Date),
    );
  });

  it("كلمة مرور خاطئة → 401", async () => {
    const password = "correctPassword";
    const password_hash = await bcrypt.hash(password, 10);
    userModelMock.findByUsername.mockResolvedValueOnce({
      id: 1,
      username: "testuser",
      password_hash,
      role: "user",
      token_version: 0,
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ username: "testuser", password: "wrongPassword" });

    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
  });

  it("اسم مستخدم غير موجود → 401", async () => {
    userModelMock.findByUsername.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post("/auth/login")
      .send({ username: "nonexistentuser", password: "anything" });

    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
  });
});

describe("POST auth/signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("user already exist", () => {});
});

describe("PATCH /auth/updatepassword", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("مدخلات صحيحة → 200 + تحديث كلمة المرور", async () => {
    const currentPass = "correctPassword";
    const password_hash = await bcrypt.hash(currentPass, 10);
    const mockUser = {
      id: 1,
      username: "testuser",
      password_hash,
      role: "user",
      token_version: 0,
    };
    userModelMock.findById.mockResolvedValue(mockUser);

    const token = generateAccessToken(mockUser);

    const res = await request(app)
      .patch("/auth/updatepassword")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPass, newPass: "newPassword123" });

    expect(res.status).toBe(200);
    expect(userModelMock.updatePasswordTx).toHaveBeenCalledWith(
      mockUser.id,
      expect.any(String),
    );
  });

  it("بدون currentPass أو newPass → 400", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      password_hash: await bcrypt.hash("anyPassword", 10),
      role: "user",
      token_version: 0,
    };
    userModelMock.findById.mockResolvedValue(mockUser);

    const token = generateAccessToken(mockUser);

    const res = await request(app)
      .patch("/auth/updatepassword")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPass: "newPassword123" });

    expect(res.status).toBe(400);
    expect(userModelMock.updatePasswordTx).not.toHaveBeenCalled();
  });

  it("currentPass غلط → 401", async () => {
    const password_hash = await bcrypt.hash("correctPassword", 10);
    const mockUser = {
      id: 1,
      username: "testuser",
      password_hash,
      role: "user",
      token_version: 0,
    };
    userModelMock.findById.mockResolvedValue(mockUser);

    const token = generateAccessToken(mockUser);

    const res = await request(app)
      .patch("/auth/updatepassword")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPass: "wrongPassword", newPass: "newPassword123" });

    expect(res.status).toBe(401);
    expect(userModelMock.updatePasswordTx).not.toHaveBeenCalled();
  });
});

describe("POST /auth/refresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("توكن صالح → 200 + توكن جديد مع تدوير", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      password_hash: await bcrypt.hash("anyPassword", 10),
      role: "user",
      token_version: 0,
    };
    userModelMock.findById.mockResolvedValue(mockUser);

    const refreshToken = generateRefreshToken(mockUser);
    tokenStoreMock.findByHash.mockResolvedValue(storedRow(refreshToken));

    const res = await request(app).post("/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(tokenStoreMock.rotate).toHaveBeenCalledWith(
      refreshTokenModel.hashToken(refreshToken),
      mockUser.id,
      refreshTokenModel.hashToken(res.body.refreshToken),
      expect.any(Date),
    );
  });

  it("توكن مدوَّر خارج نافذة السماح (إعادة استخدام) → 403 + إلغاء كل الجلسات", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      password_hash: await bcrypt.hash("anyPassword", 10),
      role: "user",
      token_version: 0,
    };
    userModelMock.findById.mockResolvedValue(mockUser);

    const refreshToken = generateRefreshToken(mockUser);
    tokenStoreMock.findByHash.mockResolvedValue(
      storedRow(refreshToken, { revoked_at: new Date(Date.now() - 60_000) }),
    );

    const res = await request(app).post("/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(403);
    expect(res.body.accessToken).toBeUndefined();
    expect(tokenStoreMock.revokeAllForUser).toHaveBeenCalledWith(mockUser.id);
    expect(tokenStoreMock.rotate).not.toHaveBeenCalled();
  });

  it("توكن مدوَّر داخل نافذة السماح (سباق) → 200 + توكن وصول بلا تدوير", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      password_hash: await bcrypt.hash("anyPassword", 10),
      role: "user",
      token_version: 0,
    };
    userModelMock.findById.mockResolvedValue(mockUser);

    const refreshToken = generateRefreshToken(mockUser);
    tokenStoreMock.findByHash.mockResolvedValue(
      storedRow(refreshToken, { revoked_at: new Date(Date.now() - 2_000) }),
    );

    const res = await request(app).post("/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.refreshToken).toBeUndefined();
    expect(tokenStoreMock.rotate).not.toHaveBeenCalled();
    expect(tokenStoreMock.revokeAllForUser).not.toHaveBeenCalled();
  });

  it("توكن غير موجود في المخزن → 403 + إلغاء كل الجلسات", async () => {
    const refreshToken = generateRefreshToken({ id: 1, token_version: 0 });
    tokenStoreMock.findByHash.mockResolvedValue(undefined);

    const res = await request(app).post("/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(403);
    expect(tokenStoreMock.revokeAllForUser).toHaveBeenCalledWith(1);
  });

  it("بدون refreshToken → 401", async () => {
    const res = await request(app).post("/auth/refresh").send({});

    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });

  it("توكن فاسد → 403", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: "invalidToken" });

    expect(res.status).toBe(403);
    expect(res.body.accessToken).toBeUndefined();
  });

  it("المستخدم غير موجود → 401", async () => {
    userModelMock.findById.mockResolvedValue(undefined);

    const refreshToken = generateRefreshToken({ id: 1, token_version: 0 });
    tokenStoreMock.findByHash.mockResolvedValue(storedRow(refreshToken));

    const res = await request(app).post("/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });

  it("token_version قديم → 401", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      password_hash: await bcrypt.hash("anyPassword", 10),
      role: "user",
      token_version: 1,
    };
    userModelMock.findById.mockResolvedValue(mockUser);

    const refreshToken = generateRefreshToken({ id: 1, token_version: 0 });
    tokenStoreMock.findByHash.mockResolvedValue(storedRow(refreshToken));

    const res = await request(app).post("/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });
});

describe("POST /auth/logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 1,
    username: "testuser",
    password_hash: "irrelevant",
    role: "user",
    token_version: 0,
  };

  it("مع refreshToken → يلغي تلك الجلسة وحدها", async () => {
    userModelMock.findById.mockResolvedValue(mockUser);
    const refreshToken = generateRefreshToken(mockUser);
    tokenStoreMock.findByHash.mockResolvedValue(storedRow(refreshToken));

    const res = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${generateAccessToken(mockUser)}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(tokenStoreMock.revoke).toHaveBeenCalledWith(
      refreshTokenModel.hashToken(refreshToken),
    );
    expect(tokenStoreMock.revokeAllForUser).not.toHaveBeenCalled();
  });

  it("بدون refreshToken → يلغي كل الجلسات", async () => {
    userModelMock.findById.mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${generateAccessToken(mockUser)}`)
      .send({});

    expect(res.status).toBe(200);
    expect(tokenStoreMock.revokeAllForUser).toHaveBeenCalledWith(mockUser.id);
    expect(tokenStoreMock.revoke).not.toHaveBeenCalled();
  });

  it("توكن يخص مستخدماً آخر → 401 بدون إلغاء", async () => {
    userModelMock.findById.mockResolvedValue(mockUser);
    const refreshToken = generateRefreshToken(mockUser);
    tokenStoreMock.findByHash.mockResolvedValue(
      storedRow(refreshToken, { user_id: 99 }),
    );

    const res = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${generateAccessToken(mockUser)}`)
      .send({ refreshToken });

    expect(res.status).toBe(401);
    expect(tokenStoreMock.revoke).not.toHaveBeenCalled();
  });
});
