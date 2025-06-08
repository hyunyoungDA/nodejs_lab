const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config')[env];

const db = {};

const sequelize = new Sequelize(config.database, config.username, config.password, config);

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const modelDefinition = require(path.join(__dirname, file));
    if (modelDefinition && modelDefinition.initiate && typeof modelDefinition.initiate === 'function') {
      modelDefinition.initiate(sequelize, Sequelize.DataTypes);
      db[modelDefinition.name] = modelDefinition;
    }
    else if (typeof modelDefinition === 'function') {
      const model = modelDefinition(sequelize, Sequelize.DataTypes);
      db[model.name] = model;
    }
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// 동적으로 테이블을 생성하는 함수
async function createDynamicTable(tableName) {
    // 이미 모델이 정의되어 있다면 반환
    if (sequelize.models[tableName]) {
        return sequelize.models[tableName];
    }
    // --- DEBUG LOG ---
    console.log(`DEBUG models/index.js (createDynamicTable): Defining new model for tableName: "${tableName}"`);

    const DynamicProfileModel = sequelize.define(
        tableName, // 모델 이름 및 테이블 이름
        {
            core: { type: Sequelize.STRING(20), allowNull: false },
            task: { type: Sequelize.STRING(20), allowNull: false },
            usaged: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
        },
        {
            timestamps: false, // createdAt, updatedAt 컬럼 자동 생성 비활성화
            underscored: false, 
            modelName: 'Profile', // 이 모델의 일반 이름 (복수형으로 테이블명 생성 방지)
            tableName: tableName, // 실제 데이터베이스 테이블 이름
            paranoid: false, // deletedAt 컬럼 자동 생성 비활성화
            charset: 'utf8',
            collate: 'utf8_general_ci',
        }
    );
    await DynamicProfileModel.sync({ force: false }); // 테이블이 없으면 생성
    return DynamicProfileModel;
}

// 모든 동적 테이블 목록을 가져오는 함수
// MySQL 사용하지만, 다른 DB에 대해서도 유연하게 처리 
async function getTableList() {
    const [results] = await sequelize.query("SHOW TABLES;");
    // MySQL의 경우, results는 [ { 'Tables_in_profiler_db': 'table_name' }, ... ] 형태
    return results.map(row => {
        if (row.Tables_in_profiler_db) { // MySQL, MariaDB
            return row.Tables_in_profiler_db;
        }
        if (row.tbl_name) { // SQLite
            return row.tbl_name;
        }
        return null;
    }).filter(name => name !== null && name !== 'SequelizeMeta'); // SequelizeMeta 필터링
}


// 특정 테이블을 삭제하는 함수
async function dropTable(tableName) {
    // --- DEBUG LOG ---
    //console.log(`DEBUG models/index.js (dropTable): Attempting to drop tableName: "${tableName}"`);
    const ModelToDrop = sequelize.models[tableName] || sequelize.define(tableName, {}, { tableName: tableName });
    await ModelToDrop.drop();
}

// 특정 테이블의 데이터를 조회하기 위한 모델을 가져오는 함수
function getDynamicModel(tableName) {
    // Sequelize.models 객체에 이미 정의된 모델이 있는지 확인
    if (sequelize.models[tableName]) {
        // --- DEBUG LOG ---
        console.log(`DEBUG models/index.js (getDynamicModel): Found existing model for tableName: "${tableName}"`);
        return sequelize.models[tableName];
    }
    // 없으면 (예: 서버 재시작 후 아직 접근 안된 테이블) 새로 정의 (스키마는 동일)
    // tableName이 유효한지 다시 한번 확인
    if (!tableName || tableName === 'null') { // Explicitly check for string 'null'
        console.error(`ERROR models/index.js (getDynamicModel): Invalid tableName provided: "${tableName}"`);
        return null;
    }

    const DynamicProfileModel = sequelize.define(
        tableName,
        {
            core: { type: Sequelize.STRING(20), allowNull: false },
            task: { type: Sequelize.STRING(20), allowNull: false },
            usaged: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
        },
        {
            timestamps: false,
            underscored: false,
            modelName: 'Profile', 
            tableName: tableName, 
            paranoid: false,
            charset: 'utf8',
            collate: 'utf8_general_ci',
        }
    );
    return DynamicProfileModel;
}

module.exports = {
    db,
    sequelize,
    Sequelize,
    createDynamicTable,
    getTableList,
    dropTable,
    getDynamicModel,
    fn: Sequelize.fn, // Sequelize.fn 내보내기
    literal: Sequelize.literal, // Sequelize.literal 내보내기
    Op: Sequelize.Op // Sequelize.Op 내보내기
};
