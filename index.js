const server = require('http').createServer();
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    }
});

tuples = [ ]


io.on('connection', client => {

    client.emit('start', tuples)

    client.on('disconnect', () => {

    });

    client.on('new-lote', (data) => {
        console.log("Novo Lote adicionado")
        const loteId = tuples.length
        tuples.push({
            id: loteId,
            title: data.title,
            descricao: data.descricao,
            valor: parseFloat(data.valor),
            lances: [],
            autor: data.autor,
            date: new Date(),
            block: false
        }) 
        io.emit("new-data", tuples)
    })

    client.on("new-lance", async (data) => {
        const loteId = data.id
        if(tuples[loteId].block) {
            client.emit("invalid-data", { message: "Recurso bloqueado no momento! Por favor, tente novamente mais tarde" })
            return
        }

        tuples[loteId].block = true

        if (parseFloat(data.valor) <= tuples[loteId].valor) {
            client.emit("invalid-data", { message: "Valor do lance atual menor do que o último lance feito!" })
            return
        }
        const newLances = tuples[loteId].lances.concat({
            user: data.user,
            valor: data.valor,
            date: new Date(),
            isPrivate: data.isPrivate,
            correctUser: data.user
        })
        
        tuples[loteId].lances = newLances
        tuples[loteId].valor = parseFloat(data.valor)
        io.emit("new-data", tuples)
        await timeout(10000)
        console.log(loteId + " liberado")
        tuples[loteId].block = false
    })
    
    function timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});


server.listen(3001)