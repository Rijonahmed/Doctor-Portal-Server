const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const port = process.env.PORT || 5000;

const app = express();

//middleware

app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kpl5w4z.mongodb.net/?retryWrites=true&w=majority`;

console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
  try {
    await client.connect();
    const appointmentOptionCollection = client.db('doctor').collection('appointmentOption');

    app.get('/appointmentOptions', async (req, res) => {
      const query = {};
      const cursor = appointmentOptionCollection.find(query);
      const appointmentOptions = await cursor.toArray();
      res.send(appointmentOptions);
    });

    app.get('/appointmentOptions/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const option = await appointmentOptionCollection.findOne(query);
      res.send(option);
    });


  }
  finally {

  }

}

run().catch(console.dir)



app.get('/', (req, res) => {
  res.send('running Doctors portal server')
});

app.listen(port, () => {
  console.log('listening to port', port)
})