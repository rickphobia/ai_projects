import type { ApiClient, Health, LoginResult } from "../src/api/client";

// A stand-in ApiClient: each answer is set per test, and calls are recorded.
export class FakeApiClient implements ApiClient {
  healthAnswer: Health | Error = { status: "ok", database: "ok" };
  loginAnswers: (LoginResult | Error)[] = [];
  logoutAnswer: Error | null = null;
  passwordsTried: string[] = [];
  logouts = 0;

  health(): Promise<Health> {
    return settle(this.healthAnswer);
  }

  login(password: string): Promise<LoginResult> {
    this.passwordsTried.push(password);
    const answer = this.loginAnswers.shift();
    if (!answer) throw new Error("the test set no login answer");
    return settle(answer);
  }

  logout(): Promise<void> {
    this.logouts += 1;
    return this.logoutAnswer
      ? Promise.reject(this.logoutAnswer)
      : Promise.resolve();
  }

  checkSession(): Promise<void> {
    return Promise.resolve();
  }
}

function settle<T>(answer: T | Error): Promise<T> {
  return answer instanceof Error
    ? Promise.reject(answer)
    : Promise.resolve(answer);
}
