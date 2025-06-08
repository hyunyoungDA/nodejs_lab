const express = require('express');
const morgan = require('morgan');
const path = require('path');
const nunjucks = require('nunjucks');
// 데이터베이스 객체 불러오기 (Sequelize 인스턴스 자체는 db.sequelize로 접근)
const { sequelize } = require('./models'); // './models'는 models/index.js에서 내보낸 객체 로드 

const indexRouter = require('./routes'); 
// 클라이언트 업로드
const profilesRouter = require('./routes/profiles');

const app = express();
app.set('port', process.env.PORT || 3001);
app.set('view engine', 'html'); // html 읽기가능 설정

nunjucks.configure('views',{
    express:app,
    watch: true, // 템플릿 변경 시 자동으로 새로고침
});

// 데이터베이스 연결 및 동기화 (models/index.js의 sequelize 인스턴스를 사용)
sequelize.sync({force: false}) // force: false는 테이블이 없으면 생성, 있으면 무시 (개발 중에는 true로 설정하여 테이블 초기화 가능)
    .then(() => {
        console.log('DB 연결 성공');
    })
    .catch((err) => {
        console.error('DB 연결 실패:', err); // 에러 로그 강화
    })

app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({extended: false})); // URL 요청 바디를 사용하기 위해

app.use('/', indexRouter);
app.use('/profiles', profilesRouter);

// 404 에러 핸들러
app.use((req, res, next) => {
    const error = new Error(`${req.url}은 잘못된 주소입니다.`);
    error.status = 404;
    next(error);
});

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
    console.error("--- 오류 핸들러 진입 ---");
    console.error("에러 객체 (err):", err);
    res.locals.message = err.message;
    res.locals.error = process.env.NODE_ENV !== 'production' ? err : {};

    // 상태 코드 설정 및 에러 페이지 렌더링
    const status = err.status || 500;
    res.status(status).render('error', {
        status: status,
        message: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : 'Production environment: stack trace is hidden.'
    });
    console.error("--- 오류 핸들러 종료 ---");
});

app.listen(app.get('port'), () => {
    console.log(app.get('port'), '번 포트에서 서버 대기 중');
});