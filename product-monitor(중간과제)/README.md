# 상품 모니터링 자동화 프로그램

## 개요
Fake Store API를 이용하여 특정 키워드가 포함된 상품을 실시간으로 탐지하는 자동화 프로그램입니다.

## 실행 방법

```bash
git clone [레포 주소]
cd product-monitor
npm install
cp .env.example .env
# .env 파일에서 KEYWORD 설정
node monitor.js
```

## 설정 예시 (.env)

```
KEYWORD=shirt
INTERVAL=10000
```

## 사용 기술
- Node.js
- dotenv
- axios
