'use strict';

const express = require('express');
const multer = require('multer');
const uploader = multer();

const multerMiddle = uploader.any();

const app = express();
app.use((req, res, next) => {
    debugger;
    multerMiddle(req, res, next);
});
app.post('/', (req, res) => {
    res.status(222).end();
});

module.exports = app.listen();