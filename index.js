// const User = require('./User')
var amqp = require('amqplib/callback_api');
const server = require('http').createServer();
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    }
});

let users = []

let messages = [
    { sender: "", receiver: "", content: "", time: new Date() }
]

amqp.connect('amqp://localhost', function (error0, connection) {
    if (error0) {
        throw error0;
    }
})


io.on('connection', client => {

    client.on('new-login', (data) => {
        const userIndex = users.findIndex((u) => u.username === data.username)
        if (userIndex !== -1) {
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
                online: true,
                connection: undefined
            })
        }

        amqp.connect('amqp://localhost', function (error0, connection) {
            if (error0) {
                throw error0;
            }

            if (userIndex !== -1) {
                users[userIndex].connection = connection
            } else {
                users[users.length - 1].connection = connection
            }

            createQueueChannel(connection, data.username, client)
        });

        const userMessages = messages.filter(message => {
            if (message.sender === data.username || message.receiver === data.username) return true
            else return false
        })

        client.emit('chat-messages', { messages: userMessages })

        for (user of users) {
            if (user.socketId === client.id) continue
            const distance = calculateDistance(user, { latitude: data.latitude, longitude: data.longitude })
            if (distance <= user.distanceRadius) {
                client.broadcast.to(user.socketId).emit('new-contact', { contact: { name: data.name, username: data.username, latitude: data.latitude, longitude: data.longitude, online: true } })
            }
            if (distance <= data.distanceRadius) {
                client.emit('new-contact', { contact: { name: user.name, username: user.username, latitude: user.latitude, longitude: user.longitude, online: true } })
            }
        }

    })

    client.on('new-message', (data) => {

        const userIndex = users.findIndex((u) => u.username === data.receiver)
        if (userIndex === -1) return

        const mess = {
            sender: data.sender,
            receiver: data.receiver,
            content: data.content,
            time: data.time
        }

        amqp.connect('amqp://localhost', function (error0, connection) {
            if (error0) { throw error0 }
            sendMessageToQueue(connection, users[userIndex].username, mess)
        });

        client.emit('get-new-message', { message: mess })

    })

    client.on('get-contacts', () => {
        const userIndex = users.findIndex((u) => u.socketId === client.id)
        if (userIndex === -1) return
        contacts = users.filter((user) => {
            if (user.socketId === client.id) return false
            const distance = calculateDistance(users[userIndex], user)
            if (distance <= users[userIndex].distanceRadius) return true
            else return false
        })
    })

    client.on('toogle-off', () =>{
        const userIndex = users.findIndex((u) => u.socketId === client.id)
        if (userIndex !== -1) {
            users[userIndex].connection.close()
            users[userIndex].online = false
            client.broadcast.emit('off-user', {
                contact: {
                    name: users[userIndex].name,
                    username: users[userIndex].username,
                    latitude: users[userIndex].latitude,
                    longitude: users[userIndex].longitude,
                    distanceRadius: users[userIndex].distanceRadius,
                    socketId: users[userIndex].socketId,
                    online: users[userIndex].online,
                }
            })
        }
    })

    client.on('toogle-on', (data)=>{
        const userIndex = users.findIndex((u) => u.username === data.username)
        if (userIndex !== -1) {
            users[userIndex].online = true
        } else return

        amqp.connect('amqp://localhost', function (error0, connection) {
            if (error0) {
                throw error0;
            }

            if (userIndex !== -1) {
                users[userIndex].connection = connection
            } else return

            createQueueChannel(connection, data.username, client)
        
        });

        for (user of users) {
            if (user.socketId === client.id) continue
            const distance = calculateDistance(user, { latitude: data.latitude, longitude: data.longitude })
            if (distance <= user.distanceRadius) {
                client.broadcast.to(user.socketId).emit('new-contact', { contact: { name: data.name, username: data.username, latitude: data.latitude, longitude: data.longitude, online: true } })
            }
        }
    })

    client.on('disconnect', () => {
        const userIndex = users.findIndex((u) => u.socketId === client.id)
        if (userIndex !== -1) {
            users[userIndex].connection.close()
            users[userIndex].online = false
            client.broadcast.emit('off-user', {
                contact: {
                    name: users[userIndex].name,
                    username: users[userIndex].username,
                    latitude: users[userIndex].latitude,
                    longitude: users[userIndex].longitude,
                    distanceRadius: users[userIndex].distanceRadius,
                    socketId: users[userIndex].socketId,
                    online: users[userIndex].online,
                }
            })
        }
    });
});

function calculateDistance(user1, user2) {
    const x = user1.latitude - user2.latitude
    const y = user1.longitude - user2.longitude
    const distance = Math.sqrt(x * x + y * y)
    return distance
}

server.listen(3001)

function createQueueChannel(connection, queueName, socket) {
    connection.createChannel(function (error1, channel) {
        if (error1) {
            throw error1;
        }
        var queue = queueName;

        channel.assertQueue(queue, {
            durable: false
        });

        channel.consume(queueName, function (mess) {

            const message = JSON.parse(mess.content.toString())

            const userIndex = users.findIndex((u) => u.username === message.receiver)

            if (userIndex === -1) return

            if (users[userIndex].online) {
                channel.ack(mess)
                messages.push(message)
                socket.broadcast.to(users[userIndex].socketId).emit('get-new-message', { message: message })
                socket.emit('get-new-message', { message: message })
            }
        });
    });
}

function sendMessageToQueue(connection, queueName, message) {
    connection.createChannel(function (error1, channel) {
        if (error1) {
            throw error1;
        }
        channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
    })
}
