'use strict';
var log4js = require('log4js');

var logFile = require('../../configs/log4js');

var logJsonReplacer = function (key, value) {
    if (key) {
        if (typeof (value) === 'object') {
            return '[Object]';
        }
        return value;
    } else {
        return value;
    }
};

log4js.configure(logFile);

exports.logger = log4js;

exports.logger.objectToLog = function (jsonInput) {
    if (jsonInput === undefined) {
        return '';
    }
    if (typeof (jsonInput) !== 'object') {
        return jsonInput;
    } else if (jsonInput.constructor === Array) {
        return '[Object]';
    }
    var jsonString = JSON.stringify(jsonInput, logJsonReplacer);
    return jsonString.replace(/['"]+/g, '')
        .replace(/[:]+/g, ': ')
        .replace(/[,]+/g, ', ')
        .slice(1, -1);
};