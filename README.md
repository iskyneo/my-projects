
# 혜인이의 성악 알아보카? (React + Supabase)

## 빠른 실행 (컴맹 모드)
1) [Supabase](https://supabase.com) 가입 → 새 프로젝트 만들기
   - Storage → 버킷 만들기: `practice-uploads` (처음엔 Public ON)
   - Project Settings → API에서 URL, anon key 복사
2) `.env` 파일 만들기 → 아래 3줄 붙여넣고 값 채우기
   ```
   VITE_SUPABASE_URL=https://...supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   VITE_YT_API_KEY= (선택)
   ```
3) 터미널에서:
   ```bash
   npm i
   npm run dev
   ```
   브라우저 자동 열림 → 이메일 입력하면 로그인 링크 도착.
4) Vercel 배포:
   - https://vercel.com → New Project → 이 폴더 연결
   - Environment Variables에 위 `.env` 3개 키 추가 → Deploy

## 보안 전환(권장)
- Storage 버킷을 Private로 전환하고, 클라이언트에서 Signed URL을 받아 재생하도록 변경.
- supabase 폴더의 SQL 참고.
