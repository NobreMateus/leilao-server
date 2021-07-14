// const User = require('./User')
const server = require('http').createServer();
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    }
});

let users = [
] 

let messages = [
    {sender: "", receiver: "", content: "", time: new Date()}
]


io.on('connection', client => {

    client.on('new-login', (data) => {
        const userIndex = users.findIndex((u) => u.username === data.username)
        if(userIndex !== -1) {
            users[userIndex].name = data.name
            users[userIndex].latitude = data.latitude
            users[userIndex].longitude = data.longitude
            users[userIndex].distanceRadius = data.distanceRadius
            users[userIndex].socketId = client.id
            users[userIndex].online = true
        } else {
            users.push({
                name: data.name,
                username: data.username,
                latitude: data.latitude,
                longitude: data.longitude,
                distanceRadius: data.distanceRadius,
                socketId: client.id,
                online: true
            })
        }

        const userMessages = messages.filter(message => {
            if(message.sender === data.username || message.receiver === data.username) return true
            else return false
        }) 

        client.emit('chat-messages', {messages: userMessages})

        for(user of users) {
            if(user.socketId === client.id) continue
            const distance = calculateDistance(user, {latitude: data.latitude, longitude: data.longitude})
            if(distance <= user.distanceRadius) {
                client.broadcast.to(user.socketId).emit('new-contact', {contact: { name: data.name, username: data.username, latitude: data.latitude, longitude: data.longitude, online: true } })
            }
            if(distance <= data.distanceRadius) {
                client.emit('new-contact', {contact: { name: user.name, username: user.username, latitude: user.latitude, longitude: user.longitude, online: true} })
            }
        }

    })

    client.on('new-message', (data) => {

        console.log(data)

        const userIndex = users.findIndex((u) => u.username === data.receiver)
        if(userIndex === -1) return
        
        const mess = {
            sender: data.sender,
            receiver: data.receiver,
            content: data.content,
            time: data.time
        }

        messages.push(mess)

        // client.broadcast.to(users[userIndex].socketId).emit('chat-messages', {messages: bothUsersMessages})
        // client.emit('chat-messages', {messages: bothUsersMessages})
        client.broadcast.to(users[userIndex].socketId).emit('get-new-message', {message: mess})
        client.emit('get-new-message', {message: mess})
    })

    client.on('get-contacts', () => {
        const userIndex = users.findIndex((u) => u.socketId === client.id)
        if(userIndex === -1) return
        contacts = users.filter((user) => {
            if(user.socketId === client.id) return false
            const distance = calculateDistance(users[userIndex], user)
            if(distance <= users[userIndex].distanceRadius) return true
            else return false
        })
        // client.emmit('new-contacts', {contacts: contacts})
    })

    client.on('disconnect', () => {
        const userIndex = users.findIndex((u) => u.socketId === client.id)
        if(userIndex !== -1) {
            users[userIndex].online = false
            client.broadcast.emit('off-user', {contact: users[userIndex]})
        }
    });
});

function calculateDistance(user1, user2) {
    const x = user1.latitude - user2.latitude
    const y = user1.longitude - user2.longitude
    const distance = Math.sqrt(x*x + y*y)
    return distance
}


server.listen(3001)