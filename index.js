const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');



const jwt = require('jsonwebtoken');
require('dotenv').config();

const stripe = require("stripe")(process.env.STRIPE_SK);
//middleware

app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kpl5w4z.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send('unauthorized access')

  }
  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'forbidden access' })
    }
    req.decoded = decoded;
    next()
  })
}


async function run() {
  try {
    await client.connect();
    const appointmentOptionCollection = client.db('doctor').collection('appointmentOption');
    const bookingsCollection = client.db('doctor').collection('bookings');
    const usersCollection = client.db('doctor').collection('users');
    const doctorsCollection = client.db('doctor').collection('doctors');
    const paymentsCollection = client.db('doctor').collection('payments');

    const verifyAdmin = async (req, res, next) => {

      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail }
      const user = await usersCollection.findOne(query)
      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })

      }
      next();
    }


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
      const query = { _id: new ObjectId(id) };
      const option = await appointmentOptionCollection.findOne(query);
      res.send(option);
    });

    app.get('/appointmentSpecialty', async (req, res) => {
      const query = {};
      const result = await appointmentOptionCollection.find(query).project({ name: 1 }).toArray();
      res.send(result);
    });

    app.get('/booking', verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: 'forbidden access' })

      }
      const query = { email: email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    })

    app.get('/booking/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const booking = await bookingsCollection.findOne(query);
      res.send(booking);
    });

    app.post('/booking', async (req, res) => {
      const booking = req.body;

      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatmentName: booking.treatmentName
      }
      const alreadyBooked = await bookingsCollection.find(query).toArray();
      if (alreadyBooked.length) {
        const message = `You already have a  booking on ${booking.appointmentDate}`
        return res.send({ acknowledged: false, message })
      }

      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });




    app.get('/booking', async (req, res) => {
      const query = {};
      const cursor = bookingsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/users', async (req, res) => {
      const query = {};
      const cursor = usersCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === 'admin' });
    });

    app.post('/users', async (req, res) => {
      const user = req.body;

      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.put('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {

      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      };
      const result = await usersCollection.updateOne(filter, updateDoc, options)
      res.send(result)
    })

    //temporariy api

    // app.get('/addprice', async (req, res) => {


    //   const filter = {};

    //   const options = { upsert: true };
    //   const updateDoc = {
    //     $set: {
    //       price: 88
    //     }
    //   };
    //   const result = await appointmentOptionCollection.updateMany(filter, updateDoc, options)
    //   res.send(result)
    // })


    // payment api

    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;


      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        "payment_method_types": [
          "card"
        ],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post('/payments', async (req, res) => {
      const payment = req.body;

      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingID;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionID
        }
      };
      const updatedResult = await bookingsCollection.updateOne(filter, updateDoc)
      res.send(result);
    })




    //jwt
    app.get('/jwt', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.find(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
        return res.send({ accessToken: token })

      }

      res.status(403).send({ accessToken: '' });
    })

    app.post('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    })

    app.delete('/doctors/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const result = await doctorsCollection.deleteOne(filter);
      res.send(result);
    })

    app.get('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const cursor = doctorsCollection.find(query);
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