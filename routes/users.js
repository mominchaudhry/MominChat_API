if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}
const express = require('express');
const jwt  = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user')
const bcrypt = require('bcrypt');
const { isValidObjectId } = require('mongoose');

//get all users
router.get('/', async (req, res) => {
    try {
        const users = await User.find()
        res.json(users)
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

router.get('/:id', getUser, async (req, res) => {
    const user = res.user
    const data = {id:req.params.id, firstName:user.firstName, lastName:user.lastName}
    res.status(200).json(data)
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

//delete user ONLY ADMIN USERS
router.delete('/:id', [authenticateToken, getUser], async (req, res) => {
    const newuser = await User.findOne({username:req.user.username}).lean()
    if (!newuser.admin) return res.status(403).json({ message: 'You don\'t have permission for that ;)' })
    try {
        await res.user.remove()
        res.status(200).json({ message: 'Successfully deleted user' })
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

//get all friends of currently logged in user
router.get('/friends/:id', async (req, res) => {
    const user = await User.findOne({_id:req.params.id}).lean()
    if (!user) return res.status(400).json({message:'User does not exist'})

    res.status(200).send(user.friends)
})

//add new friend id to currently logged in users friend list
router.post('/friends', authenticateToken, async (req, res) => {
    try {
        const newUser = await User.findOne({ username:req.body.id })
        if (!newUser) return res.status(400).json({ message:'User does not exist' })
        if (req.user.id === req.body.id) return res.status(400).json({message: 'Cannot add yourself'})

        await User.updateOne({_id:req.user.id}, {$push: {friends: {id:newUser.id, firstName:newUser.firstName, lastName:newUser.lastName}}})
        const me = await User.findOne({_id:req.user.id})

        await User.updateOne({username:req.body.id}, {$push: {friends: {id:me.id, firstName:me.firstName, lastName:me.lastName}}})
        const u = await User.findOne({_id:req.user.id}).lean()

        return res.status(201).send(u.friends)
    } catch (err) {
        console.log(err.message)
        return res.status(500).json({ message: err.message })
    }
})

//delete a friend from currently logged in user
router.delete('/friends/:id', authenticateToken, async (req, res) => {
    const user = await User.findOne({username:req.user.username}).lean()
    if (!user) res.status(400).json({message:'User does not exist'})

    const newuser = await User.findOne({_id:req.user.id}).lean()
    var _id = newuser._id
    const oldFriends = newuser.friends
    var indices = oldFriends.map(function(item) { return String(item.id) })
    var removeIndex = indices.indexOf(req.params.id)
    oldFriends.splice(removeIndex, 1)
    await User.updateOne({_id}, {$set: {friends:oldFriends}})

    const olduser = await User.findOne({_id:req.params.id})
    _id = olduser._id
    const fs = olduser.friends
    indices = fs.map(function(item) {return String(item.id)})
    removeIndex = indices.indexOf(req.user.id)
    fs.splice(removeIndex, 1)
    await User.updateOne({_id}, {$set: {friends:fs}})
    
    res.status(200).send(oldFriends)
})

router.delete('/removeFriends', authenticateToken, async (req, res) => {
    const user = await User.findOne({_id:req.user.id}).lean()
    const _id = user._id
    await User.updateOne({_id}, {$set: {friends:[]}})
    res.status(200).send()
})






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