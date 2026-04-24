import type { MatsuiLoginMethod } from "./login-method.js";
import { PasskeyLoginMethod } from "./passkey/index.js";
import { PasswordLoginMethod } from "./password/index.js";

export type LoginMethodName = "password" | "passkey";

export class LoginMethodFactory {
  static create(methodName: LoginMethodName): MatsuiLoginMethod {
    switch (methodName) {
      case "password":
        return new PasswordLoginMethod();
      case "passkey":
        return new PasskeyLoginMethod();
    }
  }
}
