require('dotenv').config(); //.env 파일에 저장된 환경변수들을 process.env 객체로 읽을 수 있도록 해주는 역할
const fetchProduct = require('./utils/fetchProduct');
const buildCarts = require('./utils/buildCarts');
const axios = require('axios');

// INTERVAL이 존재하면 해당 값으로, 없으면 default: 10000, 10진수 parsing
const INTERVAL = parseInt(process.env.INTERVAL || 10000, 10);

async function monitor() {
  const keyword = process.env.KEYWORD;
  const productId = parseInt(process.env.PRODUCT_ID, 10);
  const quantity = parseInt(process.env.QUANTITY, 10) || 1;

  const matched = await fetchProduct(keyword);

  if (matched.length > 0) {
    console.log(`[🔔 알림] '${keyword}' 포함 상품 발견!`);
    matched.forEach((item) => {
      console.log(`- ${item.title} ($${item.price})`);
    });

    console.log(`\n [🛒] ID ${productId}번 상품을 ${quantity}개 장바구니에 담았습니다.`);
    await buildCarts(productId, quantity);

    const res = await axios.get(`https://fakestoreapi.com/products/${productId}`);
    const product = res.data;
    const total = product.price * quantity;

    console.log(`\n 총 금액: $${product.price} * ${quantity} = $${total.toFixed(2)}`);


  } else {
    console.log(`[${new Date().toLocaleTimeString()}] '${keyword}' 포함 상품 없음.`);
  }
}

setInterval(monitor, INTERVAL);
monitor();
