const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;
const authRoutes = require('./Router/router');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
require('./config/auth');
const fs = require('fs');
require('./config/facebook');
// Configuration de CORS et du body parser

const path = require('path');

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const cron = require('node-cron'); // Pour planifier la vérification des rendez-vous
const https = require('https');
const {sendSMSBeforeAppointment} = require('./Controlleurs/doctor');
// Configuration de la session
app.use(session({
    secret: 'koukou',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Mettre à true si tu utilises HTTPS
}));

//const sslOptions = {
  //  key: fs.readFileSync('/etc/letsencrypt/live/wic-doctor.com/privkey.pem'),
    //cert: fs.readFileSync('/etc/letsencrypt/live/wic-doctor.com/fullchain.pem')
//};

// Initialiser Passport
app.use(passport.initialize());
app.use(passport.session());


// Routes d'authentification
app.use('/', authRoutes);

// Routes Google
app.get('/auth/google',
    passport.authenticate('google', { scope: ['email', 'profile'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', {
        successRedirect: 'https://wic-doctor.com',
        failureRedirect: '/auth/google/failure'
    })
);

app.get('/auth/protected', isLoggedIn, (req, res) => {
    let name = req.user.displayName;
    console.log("Hi, " + name);
    res.send(`Welcome, ${name}!`);
});

app.get('/auth/google/failure', (req, res) => {
    console.log("Login failed!");
    res.send('Login failed!');
});

// Middleware pour vérifier si l'utilisateur est connecté
function isLoggedIn(req, res, next) {
    req.user ? next() : res.sendStatus(401);
}


app.get('/auth/facebook', passport.authenticate('facebook'));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/' }),
    (req, res) => {
        // Successful authentication, redirect home.
        res.redirect('/');
    });

// Route d'inscription
app.post('/inscription', async (req, res) => {
    const { username, password } = req.body;

    // Vérification des champs requis
    if (!username || !password) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    try {
        // Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Génération du token
        const token = jwt.sign({ username }, 'votre_cle_secrète', { expiresIn: '1h' });

        // Insertion de l'utilisateur dans la base de données
        const query = 'INSERT INTO users (username, password, token) VALUES (?, ?, ?)';
        db.query(query, [username, hashedPassword, token], (err) => {
            if (err) {
                return res.status(500).json({ message: 'Erreur lors de l\'inscription.' });
            }
            res.status(201).json({ message: 'Utilisateur créé.', token });
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de l\'inscription.' });
    }
});

  const { verifierEtEnvoyerRappels } = require('./Controlleurs/doctor');  // Vérifiez que le chemin est correct
  
  // Planifiez la tâche pour qu'elle s'exécute toutes les minutes
  cron.schedule('* * * * *', async () => {
//      console.log('Vérification des rendez-vous et envoi des rappels...');
      try {
          await verifierEtEnvoyerRappels();  // Exécutez la fonction sans passer par une route
          console.log('Rappels envoyés avec succès');
      } catch (error) {
          console.error('Erreur lors de l\'exécution de la tâche cron:', error);
      }
  });
  
  console.log('Le serveur fonctionne et le cron est en marche...');
  const {verifierEtEnvoyerSmsRappels } = require('./Controlleurs/doctor');
//   Planifiez la tâche pour qu'elle s'exécute toutes les minutes
   cron.schedule('* * * * *', async () => {
    console.log('Vérification des rendez-vous et envoi des rappels...');
   try {
       await verifierEtEnvoyerSmsRappels();  // Exécutez la fonction sans passer par une route
      console.log('Rappels  sms envoyés avec succès');
 } catch (error) {
       console.error('Erreur lors de l\'exécution de la tâche cron:', error);
    }
});


app.use('/pdfs', express.static(path.join(__dirname, 'pdfs')));

const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: true,  // Lancer Puppeteer en mode sans tête
      args: ['--no-sandbox', '--disable-setuid-sandbox']  // Ajoutez ces options pour contourner l'erreur
    });

    const page = await browser.newPage();
    // Ajoutez ici votre logique pour générer le PDF
    await page.close();
    await browser.close();
  } catch (error) {
    console.error('Erreur lors du lancement de Puppeteer:', error);
  }
})();

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

//https.createServer(sslOptions, app).listen(3004, () => {
  //  console.log('Serveur HTTPS lancé sur le port 3002');
//});
