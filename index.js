const express = require('express')
const app = express()
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const usersRouter = require('./routes/users')

const mongoose = require('mongoose')
mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true})
const db = mongoose.connection

db.on('error', (error) => console.log(error))
db.once('open', () => console.log('Connected to database'))

app.use(express.json())

app.use(function(req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader("Access-Control-Allow-Headers", "*");
    next();
});

app.use('/api/users', usersRouter)

app.listen(
    process.env.PORT,
    () => console.log(`server at: http://localhost:${process.env.PORT}`)
)