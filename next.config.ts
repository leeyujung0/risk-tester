import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 프로덕션 빌드(npm run build && npm start)에서는 Next.js가 응답을 기본적으로
  // gzip 압축하는데, 이 과정에서 스트림 전체를 모을 때까지 버퍼링되어 AI 리포트가
  // 실시간으로 흘러나오지 않고 한 번에 도착하는 것처럼 보인다. 이를 막기 위해
  // 자동 압축을 끈다.
  compress: false,
  // Next.js 16부터 개발 서버는 localhost가 아닌 다른 origin(예: 같은 와이파이의
  // 네트워크 IP)에서 오는 요청을 기본적으로 차단한다. `npm run dev`로 실행 중
  // 터미널에 뜨는 "Network: http://<IP>:3000"의 <IP> 부분을 여기 추가해야
  // 다른 기기(휴대폰 등)에서 접속했을 때 API 호출/버튼 동작이 정상적으로 된다.
  allowedDevOrigins: ["172.21.90.68"],
};

export default nextConfig;