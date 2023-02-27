const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
require('dotenv').config();


//middleware

app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kpl5w4z.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
  try {
    await client.connect();
    const appointmentOptionCollection = client.db('doctor').collection('appointmentOption');
    const bookingsCollection = client.db('doctor').collection('bookings');


    app.get('/appointmentOptions', async (req, res) => {
      const date = req.query.date;
      const query = {};
      const cursor = appointmentOptionCollection.find(query);
      const appointmentOptions = await cursor.toArray();
      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();

      appointmentOptions.map(option => {
        const optionBooked = alreadyBooked.filter(book => book.treatmentName === option.name);
        const bookedSlots = optionBooked.map(book => book.slot);
        const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot));
        option.slots = remainingSlots;

      })

      res.send(appointmentOptions);
    });

    app.get('/appointmentOptions/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const option = await appointmentOptionCollection.findOne(query);
      res.send(option);
    });

    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    app.get('/booking', async (req, res) => {
      const query = {};
      const cursor = bookingsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
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