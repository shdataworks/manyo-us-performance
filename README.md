# ma:nyo US Performance Dashboard

US 자사몰 광고 성과 대시보드. 별도 빌드 없이 GitHub Pages에서 실행됩니다.

## 배포

Settings → Pages → Build and deployment에서 **Deploy from a branch**, **main / (root)**를 선택하고 Save를 누르세요.

## 데이터

- `data.json`: 2026-10-29 검증 스냅샷 654행. 광고비·매출을 포함하는 공개 데이터입니다.
- 원본: https://docs.google.com/spreadsheets/d/10v_FoeIpq93l0ntxvb42CP1v1l9e_jMLa-SPu-GF73Y/edit
- 접속 및 새로고침 시 Google Sheets 직접 조회를 시도하고 접근 제한 시 스냅샷을 유지합니다.
- 데이터 관리에서 CSV를 직접 불러올 수 있습니다.

## 기능

Summary / Meta / Google / Keywords / Campaign / Creative / 기간 비교 / 데이터 관리. 상단 광고비·매출·ROAS·구매·장바구니·클릭·CPC·CTR·CVR·회원가입·구독. 기간·매체·상품·광고 유형 필터, 캠페인·광고 그룹·키워드 검색, 정렬 및 CSV 다운로드.

## 수정

`index.html`: 화면 구성, `style.css`: 스타일, `app.js`: 집계와 인터랙션, `data.json`: 기본 데이터. 각 파일을 수정하고 main에 커밋하면 Pages 설정에 따라 반영됩니다.
