import test from "node:test";
import assert from "node:assert/strict";
import { isScannerSignupProbe, scannerSignupReason } from "./scannerSignup.js";

test("почта @tenable.com — пробная регистрация Nessus", () => {
  const body = {
    email: "notadmin2E284443@tenable.com",
    username: "notadmin2E284443",
    realname: "Nessus",
    comment: "Nessus test",
  };
  assert.equal(scannerSignupReason(body), "tenable-email");
  assert.equal(isScannerSignupProbe(body), true);
});

test("домен tenable.com распознаётся без учёта регистра и с поддоменом", () => {
  assert.equal(isScannerSignupProbe({ email: "Admin86EFC4CB@Tenable.COM" }), true);
  assert.equal(isScannerSignupProbe({ email: "probe@scan.tenable.com" }), true);
  assert.equal(isScannerSignupProbe({ username: "notadmin2DA29C95@tenable.com" }), true);
});

test("пометка Nessus без почты tenable тоже отклоняется", () => {
  assert.equal(scannerSignupReason({ realname: "Nessus", email: "a@example.com" }), "nessus-mark");
  assert.equal(scannerSignupReason({ comment: "Nessus test", name: "Иван" }), "nessus-mark");
  assert.equal(scannerSignupReason({ company_name: "Nessus" }), "nessus-mark");
  assert.equal(scannerSignupReason({ role_name: "nessus" }), "nessus-mark");
});

test("обычная регистрация опта и розницы не считается сканером", () => {
  assert.equal(
    isScannerSignupProbe({
      phone: "89991234567",
      name: "Анна",
      company_name: "Кофейня на углу",
      email: "anna@mail.ru",
      password: "secret",
    }),
    false,
  );
  assert.equal(isScannerSignupProbe({ email: "client@gmail.com", name: "Пётр" }), false);
  assert.equal(isScannerSignupProbe({}), false);
  assert.equal(isScannerSignupProbe(null), false);
});
