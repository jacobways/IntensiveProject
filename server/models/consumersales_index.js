'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ConsumerSales_Index extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  ConsumerSales_Index.init({
    date: DataTypes.DATE,
    value: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'ConsumerSales_Index',
  });
  return ConsumerSales_Index;
};