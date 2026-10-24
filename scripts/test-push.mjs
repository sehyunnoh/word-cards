// Sends a push to every word-cards device right now (ignores the 18-22h window and today's completion).
// Needs the worker's ADMIN_TOKEN (env var or a .admin-token file):  node scripts/test-push.mjs
const API_URL = "https://calisthenics-push.sehyun-calisthenics.workers.dev";
import { readFileSync } from "node:fs";
const token =
  process.env.ADMIN_TOKEN ||
  (() => {
    try {
      return readFileSync(new URL("../.admin-token", import.meta.url), "utf8").trim();
    } catch {
      return "";
    }
  })();
if (!token) {
  console.error("ADMIN_TOKEN 환경변수 또ток .admin-token 파일이 필요해요.");
  process.exit(1);
}

const res = await fetch(`${API_URL}/test`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ app: "word-cards" }),
});
const body = await res.json();
console.log(res.status, JSON.stringify(body));
if (res.ok && Object.keys(body.sent).length === 0) {
  console.log("등록된 word-cards 기기가 없어요. 폰에서 앱을 한 번 열어 알림을 켜주세요.");
}
