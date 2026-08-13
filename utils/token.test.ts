import { describe, it, expect } from "@jest/globals";
import jwt from "jsonwebtoken";
import { generateAccessToken } from "./token";

describe("generateAccessToken", () => {
  // Arrange: مستخدم وهمي ثابت نختبر عليه
  const fakeUser = { id: 1, role: "user" as const, token_version: 0 };

  it("ترجّع نصاً (string)", () => {
    // Act
    const token = generateAccessToken(fakeUser);
    // Assert
    expect(typeof token).toBe("string");
  });

  it("ترجّع JWT صالحاً يحمل بيانات المستخدم", () => {
    // Act
    const token = generateAccessToken(fakeUser);
    const payload = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET as string,
    ) as jwt.JwtPayload;

    // Assert
    expect(payload.id).toBe(fakeUser.id);
    expect(payload.role).toBe(fakeUser.role);
    expect(payload.token_version).toBe(fakeUser.token_version);
  });

  it("refuse if bad secret", () => {
    // Act
    const token = generateAccessToken(fakeUser);
    // Assert
    expect(() => {
      jwt.verify(token, "bad-secret");
    }).toThrow(jwt.JsonWebTokenError);
  });

  it("access token ينتهي بعد 15 دقيقة", () => {
    const token = generateAccessToken(fakeUser);
    const payload = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET as string,
    ) as jwt.JwtPayload;

    const timeDifference = (payload.exp as number) - (payload.iat as number);

    expect(timeDifference).toBe(900);
  });
});
