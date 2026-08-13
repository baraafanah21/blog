import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../app";
import * as userModel from "../models/user.model";
import { generateAccessToken, generateRefreshToken } from "../utils/token";
jest.mock("../models/user.model");

const userModelMock = userModel as jest.Mocked<typeof userModel>;

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

  it("توكن صالح → 200 + توكن جديد", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      password_hash: await bcrypt.hash("anyPassword", 10),
      role: "user",
      token_version: 0,
    };
    userModelMock.findById.mockResolvedValue(mockUser);

    const refreshToken = generateRefreshToken(mockUser);

    const res = await request(app).post("/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
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

    const refreshToken = generateRefreshToken({
      id: 1,
      role: "user",
      token_version: 0,
    });

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

    const refreshToken = generateRefreshToken({
      id: 1,
      role: "user",
      token_version: 0,
    });

    const res = await request(app).post("/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });
});
