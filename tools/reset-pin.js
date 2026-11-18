// 아이가 비밀번호(숫자 4개)를 잊어버렸을 때 새 비밀번호로 바꿔 주는 도구예요.
// 기록(코인, 친구, 펫)은 그대로 남아요.
//
// 준비 (처음 한 번만):
//   1) Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성"을 눌러 받은 JSON 파일을
//      이 폴더(tools)에 service-account.json 이라는 이름으로 넣어 주세요. 이 파일은 절대 공유하지 마세요.
//   2) 이 폴더에서:  npm install
//
// 사용:
//   node reset-pin.js 닉네임 새비밀번호4자리
//   예) node reset-pin.js 폴짝왕 5678

const admin = require('firebase-admin');
const path = require('path');

const EMAIL_DOMAIN = 'pokjjak.game'; // 게임 코드(index.html)의 EMAIL_DOMAIN과 같아야 해요.

function emailOf(nick) {
  const hex = Buffer.from(nick.normalize('NFC').toLowerCase(), 'utf8').toString('hex');
  return 'u' + hex + '@' + EMAIL_DOMAIN;
}

async function main() {
  const [nick, pin] = process.argv.slice(2);
  if (!nick || !/^\d{4}$/.test(pin || '')) {
    console.log('사용법: node reset-pin.js 닉네임 새비밀번호4자리');
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(path.join(__dirname, 'service-account.json'))) });
  try {
    const user = await admin.auth().getUserByEmail(emailOf(nick));
    await admin.auth().updateUser(user.uid, { password: 'pokjjak-' + pin });
    console.log(`'${nick}'의 비밀번호를 ${pin}(으)로 바꿨어요.`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') console.log(`'${nick}' 닉네임을 찾지 못했어요. 글자를 다시 확인해 주세요.`);
    else console.log('바꾸지 못했어요:', err.message);
    process.exit(1);
  }
}

main();
