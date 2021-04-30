if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}
const express = require('express');
const jwt  = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user')
const bcrypt = require('bcrypt')

//get all users
router.get('/', async (req, res) => {
    try {
        const users = await User.find()
        res.json(users)
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

//create user
router.post('/register', async (req, res) => {
    const { username, password: textPassword, admin, firstName, lastName, dob} = req.body
    const password = await bcrypt.hash(textPassword, 10)

    if (username.length <1) return res.status(400).json({message: 'Username missing'})
    if (textPassword.length <8) return res.status(400).json({message: 'Password must be at least 8 characters'})

    const user = new User({ username, password, admin, firstName, lastName, dob })

    try {
        const newUser = await user.save()
        res.status(201).json({message: 'Successfully registered', user:newUser})
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
})

//login
router.post('/login', async (req, res) => {

    const { username, password } = req.body

    const user = await User.findOne({username}).lean()
    
    if (!user) {
        return res.status(400).json({message:'User does not exist'})
    }

    if (await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({id: user._id, username: user.username}, process.env.ACCESS_TOKEN_SECRET)
        return res.status(200).json({message: 'Successfully logged in', token, user})
    }

    return res.status(400).json({message:'Invalid password'})
})

//update user
router.post('/changePassword', authenticateToken, async (req, res) => {
    const {username, oldPassword, newPassword} = req.body

    const user = await User.findOne({username}).lean()
    
    if (!user) {
        return res.status(400).json({message:'User does not exist'})
    }

    if (await bcrypt.compare(oldPassword, user.password)) {
        try {
            const _id = user._id
            const password = await bcrypt.hash(newPassword, 10)
            const newUser = await User.updateOne({_id}, {$set: {password}})
            res.status(200).json({message: 'Successfully changed password', user:newUser})
        } catch (err) {
            res.status(400).json({ message: err.message })
        }
    }
    return res.status(400).json({message:'Unable to change password'})
})

//delete user
router.delete('/:id', [authenticateToken, getUser], async (req, res) => {
    const newuser = await User.findOne({username:req.user.username}).lean()
    console.log(newuser)
    if (!newuser.admin) return res.status(403).json({ message: 'You don\'t have permission for that ;)' })
    try {
        await res.user.remove()
        res.status(200).json({ message: 'Successfully deleted user' })
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})








function isAdmin(req, res, next) {
    if (!req.body.user.admin) res.status(403).json({ message: 'You don\'t have permission for that ;)' })
    next()
}

async function getUser(req, res, next) {
    try {
        user = await User.findById(req.params.id)
        if (!user) {
            return res.status(404).json({ message: 'Cannot find user' })
        }
    } catch (err) {
        return res.status(500).json({ message: err.message })
    }

    res.user = user
    next()
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (!token) return res.sendStatus(401)

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403)
        req.user = user
        next()
    })
}

module.exports = router