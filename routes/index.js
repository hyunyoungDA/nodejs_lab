const express = require('express');
const router = express.Router();

// getTableList 함수 가져옴
const { getTableList } = require('../models');

// 메인 페이지 (/) 요청 처리: DB에서 테이블 목록을 가져와 Nunjucks 템플릿에 전달
router.get('/', async (req, res, next) => {
    try {
        const tableList = await getTableList(); // DB에서 테이블 목록 조회
        // console.log("DEBUG: routes/index.js - tableList for render:", tableList); // 디버깅용
        res.render('index', { tableList }); // 'index.html' 템플릿 렌더링, tableList 변수 전달
    } catch (error) {
        console.error('메인 페이지 로드 및 테이블 목록 조회 중 오류 발생:', error);
        next(error); // 에러를 Express 에러 핸들러로 전달
    }
});

module.exports = router;