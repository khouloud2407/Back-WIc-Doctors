const express= require ('express');
const authController =require ('../Controlleurs/doctor');
const loginController =require ('../Controlleurs/login');
const bodyParser = require('body-parser');
const clinicController =require ('../Controlleurs/clinic');
const paypalController = require('../Controlleurs/paiement');
const FranceController = require('../Controlleurs/doctorfrance');

const { getdoctorsbyid } = require('../Controlleurs/doctor');
const {sendSMSBeforeAppointment} = require ('../Controlleurs/doctor');
const app = express();

const passport = require('passport');

const db = require('../config/db'); // Importer la connexion à la base de données

const router= express.Router();
app.use(bodyParser.json()); // Middleware pour analyser le corps des requêtes JSON
//routefrance
router.get('/specialtiesfrance' ,FranceController.specialitespardoctorfrance);
router.get('/doctorsadd-france', FranceController.getDoctorsparvillepaysspecialites);
router.get('/search-doctors-france' ,FranceController.searchDoctorsfrance3lettre);
router.post('/send-sms',loginController.sendSMSController);
router.post('/generate-pdf', authController.generatePDF);



//route pour  l'inscription
router.get('/afftempsdoctorsbyid',authController.getDoctorsById);
router.get('/afftempsclinicsbyid',clinicController.getTempsClinicssById);
router.get('/affalldoctors', authController.getalldoctors);
router.get('/doctorsadd', authController.getDoctorsparvillepaysspecialites);
router.get('/getclinicsspcitypay', clinicController.getClinicsBySpecialityCityCountry);
router.get('/blogs' , authController.getblogs);
router.get('/getveterinaires' , authController.getveterinaires);
router.get('/getpharmaciesan' , authController.getpharmacies);
router.get('/gethopiteaux' , authController.gethopiteaux);
router.get('/getlaboratoire' , authController.getlaboratoire);
router.get('/getclinicannuaire' , authController.getclinics);
router.post('/ajouterrendezvoustele',authController.insertAppointmentteleconsultation);
//router.post('/ajouterrendezvous',authController.insertAppointment);
router.post('/send-email-with-link-paiement', loginController.sendEmailPaiement);
router.get('/getannuairetous',authController.getAllDoctorsAndDocteursTunisie);
router.get('/search-doctors', authController.searchDoctors);

router.get('/search-banque-sang', authController.getbanquesangs);

router.post('/init-payment', paypalController.initiatePayment);
router.get('/gettempsteleconsultation' , authController.getDoctorsByIdTeleconsultation);
router.get('/cities', authController.getCitiesByGovernorate);
router.get('/cities/:gouvernorat', authController.getCitiesByGovernorate);

router.get('/getPatientData/:patientId', authController.getPatientData);

// Route pour créer un paiement
router.post('/pay', paypalController.createPayment);

// Route de succès
router.get('/success', paypalController.executePayment);

// Route d'annulation
router.get('/cancel', paypalController.cancelPayment);


router.get('/specialties' ,authController.specialitespardoctor);
router.get('/doctorspos',authController.getadressempas);
router.get('/getvilles',authController.getvilles);
router.get('/getpays',authController.getpays);
router.get('/getmotif',authController.getmotif);
router.get('/gethistoriques',authController.gethistoriqu);
router.post('/ajouterrendezvous',authController.insertAppointment);
router.post('/ajouterrendezvousclinic',clinicController.insertAppointmentclinic);

//router.post('/api/forgot-password',authController.forgs);
//router.post('/api/reset-password',authController.rests);
router.post('/api/logup',loginController.signuppatients); 
router.post('/api/logupb2b',loginController.signupb2b);

router.post('/api/infob2b',loginController.infob2b);

router.put('/update/patient/:id',loginController.updateprofilpatient);
router.get('/api/assurances',loginController.getAssurances);
router.get('/getdocbyid/:id',authController.getDoctorById);
router.get('/getannuaire',authController.getAllAnnuaires);
router.get('/getannuaireinfermiere',authController.getinfermiers);
router.get('/getannuaireambulance' ,authController.getambulancess);


router.put('/updateappointement/:appointment_id',authController.updateAppointment);
router.put('/updateappointementclinic',clinicController.updateAppointment);
router.get('/availability/:clinic_id/:doctor_id', clinicController.getAvailabilityHours);
router.delete('/appointmentscancel/:id', authController.cancelAppointment);
router.delete('/appointmentscancelclinic/:id', clinicController.cancelAppointment);
router.get('/confirm/:appointmentId', authController.confirmerRendezVous);

router.get('/cancel/:appointmentId', authController.annulerRendezVous);

router.post('/send-sms', clinicController.sendSMScontact);
router.post('/api/login',loginController.signin);
// Route pour démarrer l'authentification avec Google
router.get('https://wic-doctor.com:3004/auth/google', passport.authenticate('google'));
router.post('/logout', loginController.logout);
router.post('/reset-password', loginController.resetPassword);
router.get('/api/doctorsparposition', authController.getplusprochedoc);
router.get('/api/clinicsparposition', clinicController.getplusprocheclinic);

router.get('/getclinics', clinicController.getClinic);
router.get('/doctors/clinic/:clinicId',clinicController.getSpecialitiesByClinicId);
router.get('/getspecialitiesparclinics/:clinicId', clinicController.getDoctorsAndSpeciality);
router.get('/appointments/:patientId', authController.getAppointmentsByPatientId);
router.get('/specialitiesclinic/:clinicId',clinicController.getspecialitesdeclinic);
router.get('/patternsclinic/:clinicId/:specialiteId', clinicController.getmotifByClinicAndSpecialite);
router.get('/doctorsspeciality/:specialityId/:clinicId/:patternId', clinicController.getDoctorsBySpecialityAndClinic);

router.post('/send-email-with-link', authController.sendEmail);
router.get('/patients/:user_id', loginController.obtenirPatientsParUtilisateur);

router.post('/ajoutpatients', loginController.ajouterPatient);

// Configurer body-parser pour les requêtes JSON

// Route pour vérifier manuellement les rendez-vous et envoyer des SMS
router.post('/send-reminders', async (req, res) => {
  try {
    const numbersSent = await sendSMSBeforeAppointment();
    res.status(200).json({
      message: 'Rappels SMS envoyés avec succès',
      recipients: numbersSent  // Liste des numéros de téléphone des destinataires
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi des rappels SMS:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi des rappels SMS' });
  }
});
// Route de rappel (callback) après l'authauthentification réussie
router.get('https://wic-doctor.com:3004/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // L'utilisateur est maintenant authentifié, redirige vers une page protégée ou l'accueil
        res.redirect('/dashboard'); // Change cette route selon tes besoins
    }
);

// Routes
app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));

app.get('/auth/facebook/callback', 
  passport.authenticate('facebook', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/'); // Rediriger vers la page d'accueil
  }
);

app.get('/', (req, res) => {
  res.send(req.user ? `Bonjour, ${req.user.name}` : 'Bonjour, Invité');
});
// Route de déconnexion
router.get('/logout', (req, res) => {
    req.logout(err => {
        if (err) return next(err);
        res.redirect('/'); // Redirige vers la page d'accueil après la déconnexion
    });
});

// Route pour afficher le profil de l'utilisateur (optionnelle)
router.get('/profile', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/'); // Redirige si l'utilisateur n'est pas authentifié
    }
    res.json(req.user); // Affiche les informations de l'utilisateur
});

const { verifierEtEnvoyerRappels } = require('../Controlleurs/doctor');

// Route pour vérifier et envoyer les rappels (facultatif, utilisé si vous voulez une route manuelle)
router.get('/send-reminders', async (req, res) => {
  try {
    await verifierEtEnvoyerRappels();
    res.status(200).send('Rappels envoyés avec succès');
  } catch (error) {
    res.status(500).send('Erreur lors de l\'envoi des rappels');
  }
});
module.exports = router;
