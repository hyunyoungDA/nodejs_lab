// models/index.js (수정됨: profile.js 내용 통합)

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

const sequelize = new Sequelize(config.database, config.username, config.password, config);

// models 폴더에서 profile.js를 제외한 나머지 모델 파일들을 읽어옵니다.
// 현재 프로젝트에서는 profile.js 외에 다른 모델 파일이 없으므로 이 부분은 큰 의미가 없을 수 있습니다.
// 만약 다른 고정된 모델이 있다면 여기에 포함될 것입니다.
fs
  .readdirSync(__dirname)
  .filter(file => {
    // profile.js 파일을 필터링하여 제외합니다.
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1 &&
      file !== 'profile.js' // <-- profile.js 제외
    );
  })
  .forEach(file => {
    const modelDefinition = require(path.join(__dirname, file));
    if (modelDefinition && modelDefinition.initiate && typeof modelDefinition.initiate === 'function') {
      modelDefinition.initiate(sequelize, Sequelize.DataTypes);
      db[modelDefinition.name] = modelDefinition;
    } else if (typeof modelDefinition === 'function') {
      const model = modelDefinition(sequelize, Sequelize.DataTypes);
      db[model.name] = model;
    }
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// 프로파일 데이터에 대한 공통 스키마 정의
// 이 객체를 사용하여 동적 모델을 정의합니다.
const PROFILE_SCHEMA = {
    core: { type: Sequelize.STRING(20), allowNull: false },
    task: { type: Sequelize.STRING(20), allowNull: false },
    usaged: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
};

// 데이터베이스의 모든 테이블 목록을 가져오는 함수
async function getTableList() {
    const query = `SELECT table_name FROM information_schema.tables WHERE table_schema = '${config.database}'`;
    const [results] = await sequelize.query(query);
    console.log("DEBUG: getTableList - Raw query results:", results);
    return results.map(row => row.TABLE_NAME || row.table_name);
}

// 동적 테이블 생성 함수
async function createDynamicTable(fileData) {
    const tableName = fileData[0][0];
    const dataRows = fileData.slice(1);

    if (sequelize.models[tableName]) {
        console.log(`[Sequelize] 모델 "${tableName}"은 이미 정의되어 있습니다. 데이터 추가를 시도합니다.`);
        const existingModel = sequelize.models[tableName];
        const bulkData = dataRows.map(row => ({
            core: String(row[0]).trim(),
            task: String(row[1]).trim(),
            usaged: parseInt(String(row[2]).trim(), 10),
        }));
        await existingModel.bulkCreate(bulkData);
        return existingModel;
    }

    // 동적 모델 정의 (PROFILE_SCHEMA 사용)
    const DynamicProfileModel = sequelize.define(
        tableName,
        PROFILE_SCHEMA, // <-- 여기에서 스키마를 직접 사용
        {
            sequelize,
            timestamps: false,
            underscored: false,
            modelName: tableName,
            tableName: tableName,
            paranoid: false,
            charset: 'utf8',
            collate: 'utf8_general_ci',
        }
    );

    await DynamicProfileModel.sync({ force: false });

    const bulkData = dataRows.map(row => ({
        core: String(row[0]).trim(),
        task: String(row[1]).trim(),
        usaged: parseInt(String(row[2]).trim(), 10),
    }));

    await DynamicProfileModel.bulkCreate(bulkData);
    return DynamicProfileModel;
}

// 특정 테이블을 삭제하는 함수
async function dropTable(tableName) {
    let ModelToDrop = sequelize.models[tableName];
    if (!ModelToDrop) {
        // 정의되지 않았다면 최소한의 정의로 드롭
        ModelToDrop = sequelize.define(tableName, {}, { tableName: tableName, timestamps: false, paranoid: false });
    }
    await ModelToDrop.drop();
    delete sequelize.models[tableName];
}

// 특정 테이블의 데이터를 조회하기 위한 모델을 가져오는 함수
function getDynamicModel(tableName) {
    if (sequelize.models[tableName]) {
        return sequelize.models[tableName];
    }
    // 없으면 새로 정의 (PROFILE_SCHEMA 사용)
    const DynamicProfileModel = sequelize.define(
        tableName,
        PROFILE_SCHEMA, // <-- 여기에서 스키마를 직접 사용
        {
            sequelize,
            timestamps: false,
            underscored: false,
            modelName: tableName,
            tableName: tableName,
            paranoid: false,
            charset: 'utf8',
            collate: 'utf8_general_ci',
        }
    );
    return DynamicProfileModel;
}

// db 객체에 할당하여 db 객체를 통해 sequelize 인스턴스에 접근할 수 있도록 만든 것 
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = {
    sequelize, // 인스턴스 
    ...db,
    createDynamicTable,
    getTableList,
    dropTable,
    getDynamicModel
};