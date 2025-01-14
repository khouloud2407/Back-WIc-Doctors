const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors'); // Importer cors
const app = express();
const port = 3000;
const db = require('../config/db'); // Importer la connexion à la base de données
const { info, error, Console } = require('console');
app.use(cors());
// Middleware
app.use(bodyParser.json());
const jwt = require('jsonwebtoken');
const axios = require('axios');
//app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.json());
// Configuration du transporteur Nodemailer
const transporters = nodemailer.createTransport({
    service: 'gmail', 
    port: 587,
    secure: false, // Utilisez le service de votre choix
    auth: {
        user: 'laajili.khouloud12@gmail.com', 
         pass: 'Lkoukou2024**', 
    }
});

// Fonction pour générer un mot de passe aléatoire
function generatePassword(length = 10) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
}

// Fonction d'inscription

// Fonction pour récupérer les assurances
async function getAssurances(req, res) {
    try {
        // Exécution de la requête SQL pour obtenir les assurances
        const [assurances] = await db.execute('SELECT id, nom FROM assurances');
        
        // Vérification s'il y a des assurances
        if (assurances.length === 0) {
            return res.status(404).json({ error: 'Aucune assurance trouvée.' });
        }

        // Retourner la liste des assurances sous forme de tableau JSON
        res.json(assurances);
    } catch (error) {
        console.error('Erreur lors de la récupération des assurances:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.', details: error.message });
    }
}

async function signups(req, res) {
    const { name, email, phone } = req.body;

    // Validez les entrées
    if (!name || !email || !phone) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    const password = generatePassword(); // Assurez-vous que cette fonction génère un mot de passe valide.
    const hashedPassword = await bcrypt.hash(password, 10); // 10 est le nombre de "salt rounds"

    // Insertion de l'utilisateur dans la table users
    const userSql = 'INSERT INTO users (name, email, phone_number, passwordpatient,created_at) VALUES (?, ?, ?, ?, now())';
    db.execute(userSql, [name, email, phone, hashedPassword], (err, userResults) => {
        if (err) {
            console.error('Error inserting user:', err);
            return res.status(500).json({ error: 'Database error while inserting user.' });
        }
        const userId = userResults.insertId; // ID de l'utilisateur nouvellement inséré

        // Insertion du patient avec le nom, le téléphone et l'ID de l'utilisateur
        const patientSql = 'INSERT INTO patients (user_id, phone_number, first_name) VALUES (?, ?, ?)';
        db.execute(patientSql, [userId, phone, name], (err, patientResults) => {
            if (err) {
                console.error('Error inserting patient:', err);
                return res.status(500).json({ error: 'Database error while inserting patient.' });
            }

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                port: 587,
                secure: false, 
                auth: {
                    user: 'laajili.khouloud12@gmail.com', 
                    pass: 'lmvy ldix qtgm gbna', // Remplacez ceci par un mot de passe d'application pour plus de sécurité
                },
            });

            transporter.verify((error) => {
                if (error) {
                    console.error('Error with the email connection: ', error);
                } else {
                    console.log('Email connection verified');
                }
            });

            const mailOptions = {
                from: 'laajili.khouloud12@gmail.com',
                to: email,
                subject: 'Confirmation de votre inscription à Wic-Doctor.com',
                html: `
                    <html>
                    <body>
                        <h2 style="color: #4CAF50;">Bienvenue ${name}!</h2>
                        <p>Vous êtes inscrit chez Wic-Doctor.</p>
                        <p>Afin d'accéder à votre compte, veuillez trouver votre mot de passe ci-dessous : <strong>${password}</strong></p>
                        <p>Veuillez compléter votre fiche patient, s'il vous plaît.</p>
                        <a href="http://localhost:3001/api/login" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Connexion</a>
                        <p>Si vous n'avez pas demandé cette inscription, ignorez simplement cet e-mail.</p>
                        <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
                    </body>
                    </html>
                `,
            };

            transporter.sendMail(mailOptions, function(error, info) {
                if (error) {
                    console.log(error);
                    res.send('Veuillez réessayer !');
                } else {
                    console.log('Email sent: ' + info.response);
                    res.send('Merci de vous être inscrit ! Veuillez confirmer votre e-mail ! Nous avons envoyé un lien !'); 
                }
            });
        });
    });
}
// Function to validate email format
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Basic email validation regex
    return regex.test(email);
}


async function signin(req, res) {
    const { email, phone_number, password } = req.body;
  
    // Validez les entrées
    if ((!email && !phone_number) || !password) {
      return res.status(400).json({ error: 'Email ou téléphone et mot de passe sont requis.' });
    }
  
    try {
  // Vérifiez les doublons d'email ou de téléphone
    if (email || phone_number) {
      const fieldToCheck = email ? 'email' : 'phone_number';
      const valueToCheck = email || phone_number;

//      const duplicateCheckSql = `
  ///      SELECT COUNT(*) AS count FROM users WHERE ${fieldToCheck} = ?
     // `;
     // const [duplicateResults] = await db.query(duplicateCheckSql, [valueToCheck]);

     // if (duplicateResults[0].count > 1) {
      //  const duplicateField = email ? 'Email' : 'Téléphone';
       // return res.status(409).json({ error: `${duplicateField} est dupliqué dans la base de données.` });
    //  }
    }
      // Choisir le champ d'authentification en fonction des entrées
      let field = '';
      let identifier = '';
  
      if (email) {
        field = 'email';
     identifier = email;
      } else if (phone_number) {
        field = 'phone_number';
        identifier = phone_number;
      }
     console.log(email , phone_number);
      // Rechercher l'utilisateur dans la base de données
      const sql = `SELECT * FROM users WHERE ${field} = ?`;
      const [results] = await db.query(sql, [identifier]);
  
      if (results.length === 0) {
        return res.status(401).json({ error: 'Identifiants incorrects.' });
      }
  
      const user = results[0]  ;
 // Gérer les différences entre $2y$ et $2b$
    const hashedPassword = user.passwordpatient.startsWith('$2y$')
      ? user.passwordpatient.replace('$2y$', '$2b$')
      : user.passwordpatient;

    // Vérifiez le mot de passe
    const isPasswordMatch = await bcrypt.compare(password, hashedPassword);
    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }
      // Vérifier le mot de passe
    //  const match = await bcrypt.compare(password, user.password);
    //  if (!match) {
       // return res.status(401).json({ error: 'Identifiants incorrects.' });
      //}
  
      // Générer un jeton JWT (JSON Web Token)
      const token = jwt.sign({ user_id: user.id }, 'votre_clé_secrète', { expiresIn: '8h' });
  
      // Enregistrer le token dans la base de données
      const updateSql = 'UPDATE users SET api_token = ? WHERE id = ?';
      await db.query(updateSql, [token, user.id]);
  
      // Rechercher les informations du patient
      const getSql = 'SELECT * FROM patients WHERE user_id = ?';
      const [patientResults] = await db.query(getSql, [user.id]);
  
      // Répondre avec les informations de connexion réussie
      res.json({
        message: 'Connexion réussie!',
        identifier,
        result: patientResults,
        token,
      });
  
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      return res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
  }

function sendConfirmationEmail(name, email, password, res, userId) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        port: 587,
        secure: false, 
        auth: {
            user: 'laajili.khouloud12@gmail.com', 
            pass: 'lmvy ldix qtgm gbna', // Remplacez ceci par un mot de passe d'application pour plus de sécurité
        },
    });

    const mailOptions = {
        from: 'laajili.khouloud12@gmail.com',
        to: email,
        subject: 'Confirmation de votre inscription à Wic-Doctor.com',
        html: `
            <html>
            <body>
                <h2 style="color: #4CAF50;">Bienvenue ${name}!</h2>
                <p>Vous êtes inscrit chez Wic-Doctor.</p>
                <p>Afin d'accéder à votre compte, veuillez trouver votre mot de passe ci-dessous : <strong>${password}</strong></p>
                <p>Veuillez compléter votre fiche, s'il vous plaît.</p>
                <p>Si vous n'avez pas demandé cette inscription, ignorez simplement cet e-mail.</p>
    <a href="https://wic-doctor.com/login.html" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Connexion </a>

                <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
  
          </body>
            </html>
        `,
    };
//                <a href="http://localhost:3001/api/login" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Connexion</a>

    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email.' });
        } else {
            console.log('Email sent: ' + info.response);
            // Répondre avec le message et l'ID de l'utilisateur
            return res.status(201).json({ message: 'Merci de vous être inscrit ! Veuillez confirmer votre e-mail ! Nous avons envoyé un lien !', userId });
        }
    });
}
// Function to handle B2B signup
async function signupb2b(req, res) {
    const { name, lastname, email, phone, type, speciality_id, description, pays, adresse, ville, gouvernorat, departement, region } = req.body;

    // Validate input
    if (!name || !email || !phone || !type || !lastname ){
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    console.log("bb");
    console.log("userId:", email);
    console.log("phone:", phone);
    console.log("name:", name);
    console.log("speciality_id:", speciality_id);
    console.log("description:", description);
    console.log("pays:", pays);
    console.log("adresse:", adresse);
    console.log("ville:", ville);
    console.log("gouvernorat:", gouvernorat);
    console.log("departement:", departement);
    console.log("region:", region);

    // SQL query to insert registration request
    const userSql = `
        INSERT INTO doctor_requests_b2b 
        (name, lastname, email, phone, type, speciality_id, description, pays, adresse, ville, gouvernorat, departement, region) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        // Execute the insert query
        const [userResults] = await db.execute(userSql, [
            name, 
            lastname, 
            email, 
            phone, 
            type, 
            speciality_id, 
            description ?? null, 
            pays, 
            adresse, 
            ville, 
            gouvernorat, 
            departement, 
            region
        ]);

        // If insertion is successful
        return res.status(201).json({ message: 'Demande d\'inscription ajoutée avec succès.', id: userResults.insertId });
    } catch (error) {
        console.error('Error inserting registration request:', error);
        return res.status(500).json({ error: 'Erreur lors de l\'insertion de la demande.' });
    }
}


// Function to handle B2B signup
async function signupb2b2(req, res) {
    const { name, lastname, email, phone, type, specialities, description } = req.body;

    // Validate input
    if (!name || !email || !phone || !type) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    console.log("userId:", email);
    console.log("phone:", phone);
    console.log("name:", name);
    console.log("specialities:", specialities);
    console.log("description:", description);

    // SQL query to insert registration request
    const userSql = 'INSERT INTO doctor_request (name,lastname, email, phone_number, type, specialities, description) VALUES (?, ?, ?, ?, ?,? , ?)';

    try {
        // Execute the insert query
        const [userResults] = await db.execute(userSql, [name,lastname , email, phone, type, specialities, description || null]);

        // If insertion is successful
        return res.status(201).json({ message: 'Demande d\'inscription ajoutée avec succès.', id: userResults.insertId });
    } catch (error) {
        console.error('Error inserting registration request:', error);
        return res.status(500).json({ error: 'Erreur lors de l\'insertion de la demande.' });
    }
}

async function infob2bb(req, res) {
    const { name, lastname, email, phone, type, specialities, description } = req.body;

    // Validate input
    if (!name || !email || !phone || !type) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    console.log("userId:", email);
    console.log("phone:", phone);
    console.log("name:", name);
    console.log("specialities:", specialities);
    console.log("description:", description);

    // SQL query to insert registration request
    const userSql = 'INSERT INTO doctor_questions (name,lastname, email, phone_number, type, specialities, description) VALUES (?, ?, ?, ?, ?,? , ?)';

    try {
        // Execute the insert query
        const [userResults] = await db.execute(userSql, [name,lastname , email, phone, type, specialities, description || null]);

        // If insertion is successful
        return res.status(201).json({ message: 'Demande d\'inscription ajoutée avec succès.', id: userResults.insertId });
    } catch (error) {
        console.error('Error inserting registration request:', error);
        return res.status(500).json({ error: 'Erreur lors de l\'insertion de la demande.' });
    }
}

async function infob2b(req, res) {
    const { name, lastname, email, phone, type, specialities, description } = req.body;

    // Validate input
    if (!name || !email || !phone || !type) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    console.log("userId:", email);
    console.log("phone:", phone);
    console.log("name:", name);
    console.log("specialities:", specialities);
    console.log("description:", description);

    // Captcha validation
    const recaptchaResponse = req.body['g-recaptcha-response'];
    const secretKey = '6Ld1rrEqAAAAAOQ8Kp4fDbM2rZZ0MsH97sxZi8_N';  // Remplacez par votre clé secrète

    try {
        // Vérification de la réponse reCAPTCHA auprès de l'API Google
        const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
            params: {
                secret: secretKey,
                response: recaptchaResponse
            }
        });

        const data = response.data;

        // Si la vérification échoue
        if (!data.success) {
            return res.status(400).json({ error: 'Échec de la validation reCAPTCHA. Essayez encore.' });
        }
    } catch (error) {
        console.error('Erreur lors de la vérification reCAPTCHA:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur lors de la validation reCAPTCHA.' });
    }

    // SQL query to insert registration request
    const userSql = 'INSERT INTO doctor_questions (name, lastname, email, phone_number, type, specialities, description) VALUES (?, ?, ?, ?, ?, ?, ?)';

    try {
        // Execute the insert query
        const [userResults] = await db.execute(userSql, [name, lastname, email, phone, type, specialities, description || null]);

        // If insertion is successful
        return res.status(201).json({ message: 'Demande d\'inscription ajoutée avec succès.', id: userResults.insertId });
    } catch (error) {
        console.error('Error inserting registration request:', error);
        return res.status(500).json({ error: 'Erreur lors de l\'insertion de la demande.' });
    }
}


const logout = async (req, res) => {
    try {
        // Retrieve the token from the authorization header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        // Check if token is provided
        if (!token) {
            return res.status(401).json({ message: 'Token missing, authorization denied.' });
        }

        // Verify the token
        const decoded = jwt.verify(token, 'votre_clé_secrète'); // S'assurer d'attraper l'erreur
        const userId = decoded.user_id; // Assuming your token contains user_id

        // Nullify or delete the token from the database
        const query = 'UPDATE users SET api_token = NULL WHERE id = ?';
        const [result] = await db.query(query, [userId]);

        // If the user is successfully updated
        if (result.affectedRows > 0) {
            return res.status(200).json({ message: 'Successfully logged out.' });
        } else {
            return res.status(404).json({ message: 'User not found.' });
        }
    } catch (error) {
        // Handle errors
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(403).json({ message: 'Invalid token.' });
        }
        console.error('Failed to logout:', error);
        return res.status(500).json({ error: 'Failed to logout.' });
    }
};



// Function to create a wait time
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to reset the password
const resetPassword = async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;

    try {
        // Find the user by ID
        const query = 'SELECT * FROM users WHERE id = ?';
        const [results] = await db.query(query, [userId]);

        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const user = results[0];

        // Compare the current password with the stored password
        const isMatch = await bcrypt.compare(currentPassword, user.passwordpatient);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10); // Use bcrypt to hash the new password

        // Update the user's password in the database
        const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';
        await db.query(updateQuery, [hashedNewPassword, userId]);

        // Wait for 2 seconds before sending the response (adjust the time as needed)
       // await wait(2000); // Wait for 2000 milliseconds (2 seconds)

        return res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Error during password reset:', error);
        return res.status(500).json({ error: 'An error occurred while resetting the password.' });
    }
};


async function updateprofilpatient(req, res) {
    const patientId = req.params.id;
    const {
        first_name,
        last_name,
antecedent,
        phone_number,
        mobile_number,
        age,
        gender,
        weight,
        height,
        medical_history,
        notes,
        email,
        matriculeCNSS,
        dateExpiration,
        assurance_id,  // L'ID de l'assurance envoyé par le front-end
        groupe_sanguin,
        allergie,
        date_naissance,
       // nom_assurrance
    } = req.body;

    try {
        // Vérifier si le patient existe
        const [currentPatient] = await db.execute('SELECT * FROM patients WHERE id = ?', [patientId]);
        if (currentPatient.length === 0) {
            return res.status(404).json({ error: 'Patient non trouvé.' });
        }

        const currentData = currentPatient[0];

        // Vérifier que le numéro de téléphone est fourni
        if (!phone_number || phone_number.trim() === '') {
            return res.status(400).json({ error: 'Le numéro de téléphone est obligatoire.' });
        }
if (phone_number !== currentData.phone_number) {
    const [existingPhone] = await db.execute(
        'SELECT id FROM patients WHERE phone_number = ? AND id != ? AND phone_number IS NOT NULL AND phone_number != ""',
        [phone_number, patientId]
    );
    if (existingPhone.length > 0) {
        return res.status(409).json({ error: 'Le numéro de téléphone est déjà utilisé.' });
    }
}
        // Vérifier les doublons pour le numéro de téléphone
      //  const [existingPhone] = await db.execute(
          //  'SELECT id FROM patients WHERE phone_number = ? AND id != ? AND phone_number IS NOT NULL AND phone_number != ""',
        //    [phone_number, patientId]
      //  );
    //    if (existingPhone.length > 0) {
  //          return res.status(409).json({ error: 'Le numéro de téléphone est déjà utilisé.' });
//        }

        // Vérifier les doublons pour l'email
        if (email && email.trim() !== '') {
            const [existingEmail] = await db.execute(
                'SELECT id FROM patients WHERE email = ? AND id != ? AND email IS NOT NULL AND email != ""',
                [email, patientId]
            );
            if (existingEmail.length > 0) {
                return res.status(409).json({ error: 'L\'adresse e-mail est déjà utilisée.' });
            }
        }

        // Vérifier que l'ID de l'assurance est valide
        if (assurance_id) {
            const [existingAssurance] = await db.execute('SELECT id FROM assurances WHERE id = ?', [assurance_id]);
            if (existingAssurance.length === 0) {
                return res.status(404).json({ error: 'Assurance non trouvée.' });
            }
        }

        // Préparer les champs à mettre à jour
        const updates = [];
        const values = [];
        const fieldsToUpdate = {
            first_name: first_name ? JSON.stringify({ fr: first_name }) : currentData.first_name,
            last_name: last_name ? JSON.stringify({ fr: last_name }) : currentData.last_name,
            phone_number: phone_number, // Obligatoire et toujours mis à jour
            mobile_number: mobile_number ?? currentData.mobile_number,
            age: age ?? currentData.age,
            gender: gender ?? currentData.gender,
            weight: weight ?? currentData.weight,
            height: height ?? currentData.height,
            medical_history: medical_history ?? currentData.medical_history,
            notes: notes ?? currentData.notes,
            matriculeCNSS: matriculeCNSS ?? currentData.matriculeCNSS,
            dateExpiration: dateExpiration ?? currentData.dateExpiration,
            assurance: assurance_id ?? currentData.assurance, // Mettre à jour avec l'ID de l'assurance
            groupe_sanguin: groupe_sanguin ?? currentData.groupe_sanguin,
            allergie: allergie ?? currentData.allergie,
            date_naissance: date_naissance ?? currentData.date_naissance,
            antecedent :antecedent ?? currentData.antecedent,
           // nom_assurrance: nom_assurrance ?? currentData.nom_assurrance,
            email: email ?? currentData.email
        };

        for (const [field, value] of Object.entries(fieldsToUpdate)) {
            if (value !== undefined) {
                updates.push(`${field} = ?`);
                values.push(value);
            }
        }

        updates.push(`updated_at = NOW()`);
        values.push(patientId);

        // Requête de mise à jour des patients
        const updatePatientQuery = `UPDATE patients SET ${updates.join(', ')} WHERE id = ?`;
        const [patientResult] = await db.execute(updatePatientQuery, values);

        if (patientResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Patient non trouvé.' });
        }

        // Mise à jour des données dans la table users
        const updateUserQuery = `
            UPDATE users
            SET 
                email = ?, 
                phone_number = ?, 
                name = ?, 
                lastname = ?
            WHERE id = (
                SELECT user_id FROM patients WHERE id = ?
            )
        `;
        const userValues = [
            email ?? currentData.email,
            phone_number,
            JSON.stringify({ fr: first_name }) || currentData.first_name,
            JSON.stringify({ fr: last_name }) || currentData.last_name,
            patientId
        ];

        const [userResult] = await db.execute(updateUserQuery, userValues);
        if (userResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé pour le patient.' });
        }

        // Réponse en cas de succès
        res.json({ message: 'Profil mis à jour avec succès !' });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.', details: error.message });
    }
}

async function updateprofilpatient5(req, res) {
    const patientId = req.params.id;
    const {
        first_name,
        last_name,
        phone_number,
        mobile_number,
        age,
        gender,
        weight,
        height,
        medical_history,
        notes,
        email,
        matriculeCNSS,
        dateExpiration,
        assurance, // ID de l'assurance choisie
        groupe_sanguin,
        allergie,
        date_naissance,
       // nom_assurrance
    } = req.body;

    try {
        // Vérifier si le patient existe
        const [currentPatient] = await db.execute('SELECT * FROM patients WHERE id = ?', [patientId]);
        if (currentPatient.length === 0) {
            return res.status(404).json({ error: 'Patient non trouvé.' });
        }

        const currentData = currentPatient[0];

        // Récupérer la liste des assurances disponibles
        const [assurance] = await db.execute('SELECT id, nom  FROM assurances');
        if (!assurances.length) {
            return res.status(404).json({ error: 'Aucune assurance disponible.' });
        }

        // Si aucune assurance n'est spécifiée, renvoyer la liste des assurances
        if (!assurance) {
            return res.status(200).json({
                message: 'Veuillez choisir une assurance.',
                assurances
            });
        }

        // Vérifier si l'assurance choisie existe
        const [assuranceExists] = await db.execute('SELECT * FROM assurances WHERE id = ?', [assurance_id]);
        if (assuranceExists.length === 0) {
            return res.status(400).json({ error: 'L\'assurance choisie est invalide.' });
        }

        // Vérifier que le numéro de téléphone est fourni
        if (!phone_number || phone_number.trim() === '') {
            return res.status(400).json({ error: 'Le numéro de téléphone est obligatoire.' });
        }

        // Vérifier si le numéro de téléphone a changé
        if (phone_number !== currentData.phone_number) {
            // Vérifier les doublons pour le numéro de téléphone
            const [existingPhone] = await db.execute(
                'SELECT id FROM patients WHERE phone_number = ? AND id != ? AND phone_number IS NOT NULL AND phone_number != ""',
                [phone_number, patientId]
            );
            if (existingPhone.length > 0) {
                return res.status(409).json({ error: 'Le numéro de téléphone est déjà utilisé.' });
            }
        }

        // Vérifier si l'email a changé
        if (email && email.trim() !== '' && email !== currentData.email) {
            const [existingEmail] = await db.execute(
                'SELECT id FROM patients WHERE email = ? AND id != ? AND email IS NOT NULL AND email != ""',
                [email, patientId]
            );
            if (existingEmail.length > 0) {
                return res.status(409).json({ error: 'L\'adresse e-mail est déjà utilisée.' });
            }
        }

        // Préparer les champs à mettre à jour
        const updates = [];
        const values = [];
        const fieldsToUpdate = {
            first_name: first_name ? JSON.stringify({ fr: first_name }) : currentData.first_name,
            last_name: last_name ? JSON.stringify({ fr: last_name }) : currentData.last_name,
            phone_number: phone_number,
            mobile_number: mobile_number ?? currentData.mobile_number,
            age: age ?? currentData.age,
            gender: gender ?? currentData.gender,
            weight: weight ?? currentData.weight,
            height: height ?? currentData.height,
            medical_history: medical_history ?? currentData.medical_history,
            notes: notes ?? currentData.notes,
            matriculeCNSS: matriculeCNSS ?? currentData.matriculeCNSS,
            dateExpiration: dateExpiration ?? currentData.dateExpiration,
            assurance: assurances.id, // Mettre à jour avec l'ID de l'assurance choisie
            groupe_sanguin: groupe_sanguin ?? currentData.groupe_sanguin,
            allergie: allergie ?? currentData.allergie,
            date_naissance: date_naissance ?? currentData.date_naissance,
          //  assurrance: nom_assurrance ?? currentData.nom_assurrance,
            email: email ?? currentData.email
        };

        for (const [field, value] of Object.entries(fieldsToUpdate)) {
            if (value !== undefined) {
                updates.push(`${field} = ?`);
                values.push(value);
            }
        }

        updates.push(`updated_at = NOW()`);
        values.push(patientId);

        // Requête de mise à jour des patients
        const updatePatientQuery = `UPDATE patients SET ${updates.join(', ')} WHERE id = ?`;
        const [patientResult] = await db.execute(updatePatientQuery, values);

        if (patientResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Patient non trouvé.' });
        }

        // Réponse en cas de succès
        res.json({ message: 'Profil mis à jour avec succès !' });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.', details: error.message });
    }
}

async function updateprofilpatient5(req, res) {
    const patientId = req.params.id;
    const {
        first_name,
        last_name,
        phone_number,
        mobile_number,
        age,
        gender,
        weight,
        height,
        medical_history,
        notes,
        email,
        matriculeCNSS,
        dateExpiration,
        assurance,
        groupe_sanguin,
        allergie,
        date_naissance,
        nom_assurrance,
antecedent
    } = req.body;

    try {
        // Vérifier si le patient existe
        const [currentPatient] = await db.execute('SELECT * FROM patients WHERE id = ?', [patientId]);
        if (currentPatient.length === 0) {
            return res.status(404).json({ error: 'Patient non trouvé.' });
        }

        const currentData = currentPatient[0];

        // Vérifier que le numéro de téléphone est fourni
        if (!phone_number || phone_number.trim() === '') {
            return res.status(400).json({ error: 'Le numéro de téléphone est obligatoire.' });
        }

        // Vérifier si le numéro de téléphone a changé
        if (phone_number !== currentData.phone_number) {
            // Vérifier les doublons pour le numéro de téléphone
            const [existingPhone] = await db.execute(
                'SELECT id FROM patients WHERE phone_number = ? AND id != ? AND phone_number IS NOT NULL AND phone_number != ""',
                [phone_number, patientId]
            );
            if (existingPhone.length > 0) {
                return res.status(409).json({ error: 'Le numéro de téléphone est déjà utilisé.' });
            }
        }

        // Vérifier les doublons pour l'email
        if (email && email.trim() !== '' && email !== currentData.email) {
            const [existingEmail] = await db.execute(
                'SELECT id FROM patients WHERE email = ? AND id != ? AND email IS NOT NULL AND email != ""',
                [email, patientId]
            );
            if (existingEmail.length > 0) {
                return res.status(409).json({ error: 'L\'adresse e-mail est déjà utilisée.' });
            }
        }

        // Préparer les champs à mettre à jour
        const updates = [];
        const values = [];
        const fieldsToUpdate = {
            first_name: first_name ? JSON.stringify({ fr: first_name }) : currentData.first_name,
            last_name: last_name ? JSON.stringify({ fr: last_name }) : currentData.last_name,
            phone_number: phone_number, // Obligatoire et toujours mis à jour
            mobile_number: mobile_number ?? currentData.mobile_number,
            age: age ?? currentData.age,
            gender: gender ?? currentData.gender,
            weight: weight ?? currentData.weight,
            height: height ?? currentData.height,
            medical_history: medical_history ?? currentData.medical_history,
            notes: notes ?? currentData.notes,
            matriculeCNSS: matriculeCNSS ?? currentData.matriculeCNSS,
            dateExpiration: dateExpiration ?? currentData.dateExpiration,
            assurance: assurance ?? currentData.assurance,
            groupe_sanguin: groupe_sanguin ?? currentData.groupe_sanguin,
            allergie: allergie ?? currentData.allergie,
            date_naissance: date_naissance ?? currentData.date_naissance,
            nom_assurrance: nom_assurrance ?? currentData.nom_assurrance,
            email: email ?? currentData.email,
antecedent: antecedent ?? currentData.antecedent 
        };

        for (const [field, value] of Object.entries(fieldsToUpdate)) {
            if (value !== undefined) {
                updates.push(`${field} = ?`);
                values.push(value);
            }
        }

        updates.push(`updated_at = NOW()`);
        values.push(patientId);

        // Requête de mise à jour des patients
        const updatePatientQuery = `UPDATE patients SET ${updates.join(', ')} WHERE id = ?`;
        const [patientResult] = await db.execute(updatePatientQuery, values);

        if (patientResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Patient non trouvé.' });
        }

        // Mise à jour des données dans la table users
        const updateUserQuery = `
            UPDATE users
            SET 
                email = ?, 
                phone_number = ?, 
                name = ?, 
                lastname = ?
            WHERE id = (
                SELECT user_id FROM patients WHERE id = ?
            )
        `;
        const userValues = [
            email ?? currentData.email,
            phone_number,
            JSON.stringify({ fr: first_name }) || currentData.first_name,
            JSON.stringify({ fr: last_name }) || currentData.last_name,
            patientId
        ];

        const [userResult] = await db.execute(updateUserQuery, userValues);
        if (userResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé pour le patient.' });
        }

        // Réponse en cas de succès
        res.json({ message: 'Profil mis à jour avec succès !' });
//return userResult ;
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.', details: error.message });
    }
}

// Update patient profile
// Fonction pour mettre à jour le profil du patient
// Fonction pour mettre à jour le profil du patient
async function updateprofilpatient2(req, res) {
    const patientId = req.params.id;
    const {
        first_name,
        last_name,
        phone_number,
        mobile_number,
        age,
        gender,
        weight,
        height,
        medical_history,
        notes,
        email,
        matriculeCNSS,
        dateExpiration,
        assurance,
        groupe_sanguin,
        allergie,
        date_naissance,
        nom_assurrance
    } = req.body;

    try {
        // Vérifier si le patient existe
        const [currentPatient] = await db.execute('SELECT * FROM patients WHERE id = ?', [patientId]);
        if (currentPatient.length === 0) {
            return res.status(404).json({ error: 'Patient non trouvé.' });
        }

        const currentData = currentPatient[0];

        // Vérifier que le numéro de téléphone est fourni
        if (!phone_number || phone_number.trim() === '') {
            return res.status(400).json({ error: 'Le numéro de téléphone est obligatoire.' });
        }

        // Vérifier les doublons pour le numéro de téléphone
      //  const [existingPhone] = await db.execute(
          //  'SELECT id FROM patients WHERE phone_number = ? AND id != ? AND phone_number IS NOT NULL AND phone_number != ""',
         //   [phone_number, patientId]
       // );
      //  if (existingPhone.length > 0) {
         //   return res.status(409).json({ error: 'Le numéro de téléphone est déjà utilisé.' });
       // }

        // Vérifier les doublons pour l'email
      //  if (email && email.trim() !== '') {
        //    const [existingEmail] = await db.execute(
            //    'SELECT id FROM patients WHERE email = ? AND id != ? AND email IS NOT NULL AND email != ""',
          //      [email, patientId]
        //    );
      //      if (existingEmail.length > 0) {
    //            return res.status(409).json({ error: 'L\'adresse e-mail est déjà utilisée.' });
  //          }
//        }

        // Préparer les champs à mettre à jour
        const updates = [];
        const values = [];
        const fieldsToUpdate = {
            first_name: first_name ? JSON.stringify({ fr: first_name }) : currentData.first_name,
            last_name: last_name ? JSON.stringify({ fr: last_name }) : currentData.last_name,
            phone_number: phone_number, // Obligatoire et toujours mis à jour
            mobile_number: mobile_number ?? currentData.mobile_number,
            age: age ?? currentData.age,
            gender: gender ?? currentData.gender,
            weight: weight ?? currentData.weight,
            height: height ?? currentData.height,
            medical_history: medical_history ?? currentData.medical_history,
            notes: notes ?? currentData.notes,
            matriculeCNSS: matriculeCNSS ?? currentData.matriculeCNSS,
            dateExpiration: dateExpiration ?? currentData.dateExpiration,
            assurance: assurance ?? currentData.assurance,
            groupe_sanguin: groupe_sanguin ?? currentData.groupe_sanguin,
            allergie: allergie ?? currentData.allergie,
            date_naissance: date_naissance ?? currentData.date_naissance,
            nom_assurrance: nom_assurrance ?? currentData.nom_assurrance,
            email: email ?? currentData.email
        };

        for (const [field, value] of Object.entries(fieldsToUpdate)) {
            if (value !== undefined) {
                updates.push(`${field} = ?`);
                values.push(value);
            }
        }

        updates.push(`updated_at = NOW()`);
        values.push(patientId);

        // Requête de mise à jour des patients
        const updatePatientQuery = `UPDATE patients SET ${updates.join(', ')} WHERE id = ?`;
        const [patientResult] = await db.execute(updatePatientQuery, values);

        if (patientResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Patient non trouvé.' });
        }

        // Mise à jour des données dans la table users
        const updateUserQuery = `
            UPDATE users
            SET 
                email = ?, 
                phone_number = ?, 
                name = ?, 
                lastname = ?
            WHERE id = (
                SELECT user_id FROM patients WHERE id = ?
            )
        `;
        const userValues = [
            email ?? currentData.email,
            phone_number,
            JSON.stringify({ fr: first_name }) || currentData.first_name,
            JSON.stringify({ fr: last_name }) || currentData.last_name,
            patientId
        ];

        const [userResult] = await db.execute(updateUserQuery, userValues);
        if (userResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé pour le patient.' });
        }
    const [existingPhone] = await db.execute(
            'SELECT id FROM patients WHERE phone_number = ? AND id != ? AND phone_number IS NOT NULL AND phone_number != ""',
            [phone_number, patientId]
        );
        if (existingPhone.length > 1) {
            return res.status(409).json({ error: 'Le numéro de téléphone est déjà utilisé.' });
        }

        // Vérifier les doublons pour l'email
        if (email && email.trim() !== '') {
            const [existingEmail] = await db.execute(
                'SELECT id FROM patients WHERE email = ? AND id != ? AND email IS NOT NULL AND email != ""',
                [email, patientId]
            );
            if (existingEmail.length > 0) {
                return res.status(409).json({ error: 'L\'adresse e-mail est déjà utilisée.' });
            }
        }


        // Réponse en cas de succès
        res.json({ message: 'Profil mis à jour avec succès !' });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.', details: error.message });
    }
}
async function updateprofilpatients(req, res) {
    const patientId = req.params.id;
    const {
        first_name,
        last_name,
        phone_number,
        mobile_number,
        age,
        gender,
        weight,
        height,
        medical_history,
        notes,
        email,
        matriculeCNSS,
        dateExpiration,
        assurance,
        groupe_sanguin,
        allergie,
        date_naissance,
        
        antecedent
    } = req.body;

    try {
        // Vérifier si le patient existe
        const [currentPatient] = await db.execute('SELECT * FROM patients WHERE id = ?', [patientId]);
        if (currentPatient.length === 0) {
            return res.status(404).json({ error: 'Patient non trouvé.' });
        }

        const currentData = currentPatient[0];
        const updates = [];
        const values = [];

        // Préparer les champs à mettre à jour
        const fieldsToUpdate = {
        first_name,
        last_name,
        phone_number,
        mobile_number,
        age,
        gender,
        weight,
        height,
        medical_history,
        notes,
        email,
        matriculeCNSS,
        dateExpiration,
        assurance,
        groupe_sanguin,
        allergie,
        date_naissance,

        antecedent

        };

        for (const [field, value] of Object.entries(fieldsToUpdate)) {
            updates.push(`${field} = ?`);
            values.push(value !== undefined ? value : currentData[field]);        }
        updates.push(`updated_at = NOW()`);
        values.push(patientId);

        // Requête de mise à jour des patients
        const updatePatientQuery = `UPDATE patients SET ${updates.join(', ')} WHERE id = ?`;

        // Exécuter la mise à jour des patients
        const [patientResult] = await db.execute(updatePatientQuery, values);
        if (patientResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Patient non trouvé.' });
        }

        // Mise à jour des données dans la table users
        const updateUserQuery = `
            UPDATE users
            SET email = ?, phone_number = ?, name = ?, lastname = ?
            WHERE id = (
                SELECT user_id FROM patients WHERE id = ?
            )
        `;
        const userValues = [
            email !== undefined ? email : currentData.email,
            phone_number !== undefined ? phone_number : currentData.phone_number,
            first_name !== undefined ? first_name : currentData.first_name,
            last_name !== undefined ? last_name : currentData.last_name,
            patientId
        ];

        const [userResult] = await db.execute(updateUserQuery, userValues);
        if (userResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé pour le patient.' });
        }

        // Réponse en cas de succès
        res.json({ message: 'Profil mis à jour avec succès !' });

    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.', details: error.message });
    }
}

// Function to send SMS
const sendSMScontactinscrit = async (phone, message) => {
    const api_key = 'INS757364498'; // Replace with your actual API key
    const from = '33743134488'; // Replace with your sender ID
    const alphasender = 'wic doctor'; // Replace with your alpha sender
  
    const url = 'https://sms.way-interactive-convergence.com/apis/smscontact/';
    const fields = {
      apikey: api_key,
      from: from,
      to: phone,
      message: message,
      alphasender: alphasender,
    };
  
    try {
      const response = await axios.post(url, new URLSearchParams(fields), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw new Error('Failed to send SMS');
    }
  };
  
  // Function to handle patient signup
  const signuppatient = async (req, res) => {
    const { email, phone, lastname, name } = req.body;
  
    // Validate input
    if (!name || !lastname || !email || !phone) {
      return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }
  
    try {
      const password = generatePassword(); // Ensure this function generates a valid password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Insert the user into the `users` table
      const userSql = 'INSERT INTO users (name, lastname, email, phone_number, passwordpatient, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
      const [userResults] = await db.execute(userSql, [name, lastname, email, phone, hashedPassword]);
  
      const userId = userResults.insertId; // ID of the newly inserted user
  
      //Insert into the `patients` table
      const insertSql = 'INSERT INTO patients (user_id, first_name, last_name, created_at) VALUES (?, ?, ?, ?, NOW())';
      const values = [userId, name, lastname, phone];
      await db.execute(insertSql, values);
  
      // Prepare the confirmation message
      const message = `Bienvenue ${name}!\n` +
                   `Vous êtes inscrit chez Wic-Doctor.\n` +
                   `Afin d'accéder à votre compte, veuillez trouver votre mot de passe ci-dessous : ${password}\n` +
                   `Veuillez compléter votre fiche, s'il vous plaît.\n` +
            
                   `Si vous n'avez pas demandé cette inscription, ignorez simplement ce message.\n` +
                   `Cordialement,\nL'équipe de Wic-Doctor.`;
    
      // Send confirmation email
      sendConfirmationEmail(`${name} ${lastname}`, email, password, res, userId);
      
      // Send SMS with the same message
     // await sendSMScontactinscrit(phone, message);
  
      // Respond with success
      return res.status(201).json({ message: 'Inscription réussie et confirmation envoyée.' });
  
    } catch (error) {
      console.error('Error during patient signup:', error);
      return res.status(500).json({ error: 'Une erreur est survenue lors de l\'inscription.' });
    }
  }

 const signuppatients = async (req, res) => {
    const { email, phone, lastname, name } = req.body;
      const errors = [];

    // Validate input
    if (!phone) {
      return res.status(400).json({ error: 'Le numéro de téléphone est requis.' });
    }
 const [currentPatient] = await db.execute('SELECT  email ,phone_number  FROM users');
        if (currentPatient.length === 0) {
            return res.status(404).json({ error: 'Patient non trouvé.' });
        }

        const currentData = currentPatient[0];
if (phone !== currentData.phone_number) {
    const [existingPhone] = await db.execute(
        'SELECT id FROM users WHERE phone_number = ? AND phone_number IS NOT NULL AND phone_number != ""',
        [phone]
    );
    if (existingPhone.length > 0) {
//        return res.status(409).json({ error: 'Le numéro de téléphone est déjà utilisé.' });
        errors.push('Le numéro de téléphone est déjà utilisé.');

    }
}

// Vérification pour l'email
if (email !== currentData.email) {
    const [existingEmail] = await db.execute(
        'SELECT id FROM users WHERE email = ? AND email IS NOT NULL AND email != ""',
        [email]
    );
    if (existingEmail.length > 0) {
//        return res.status(409).json({ error: 'L\'adresse e-mail est déjà utilisée.' });
        errors.push('L\'adresse e-mail est déjà utilisée.');

    }
}
 if (errors.length > 0) {
            return res.status(409).json({ errors }); // Retourner toutes les erreurs regroupées
        }

 try{
    


      const generatedPassword = generatePassword(); // Ensure this function generates a valid password
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);
  
      // Normalize the phone number (remove any non-digit characters)
      const normalizedPhone = phone.replace(/[^\d]/g, ''); // Supprime tout caractère non numérique
  // Format names as JSON
      const nameJson = JSON.stringify({ fr: name || '' });
      const lastnameJson = JSON.stringify({ fr: lastname || '' });  
      // Insert the user into the `users` table
      const userSql =
        'INSERT INTO users (name, lastname, email, phone_number, passwordpatient, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
      const [userResults] = await db.execute(userSql, [name, lastname, email || null, phone, hashedPassword]);
  
      const userId = userResults.insertId; // ID of the newly inserted user
  
      // Insert into the `patients` table
      const insertSql =
        'INSERT INTO patients (user_id, first_name, last_name, phone_number, email, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
      const values = [userId, nameJson, lastnameJson, phone, email || null];
      await db.execute(insertSql, values);
  
      // Prepare the confirmation message
      const message =
        `Bienvenue ${name}!\n` +
        `Vous êtes inscrit chez Wic-Doctor.\n` +
        `Afin d'accéder à votre compte, veuillez trouver votre mot de passe ci-dessous : ${generatedPassword}\n` +
        `Veuillez compléter votre fiche, s'il vous plaît.\n` +
         

        `Si vous n'avez pas demandé cette inscription, ignorez simplement ce message.\n` +
        `Cordialement,\nL'équipe de Wic-Doctor.`;
  
      // Send confirmation email (if email exists)
      if (email) {
        await sendConfirmationEmail(`${name} ${lastname}`, email, generatedPassword, res, userId);
        await sendSMScontactinscrit(normalizedPhone, message);

      }
  
      // Send SMS confirmation (if phone exists)
      if (normalizedPhone) {
        await sendSMScontactinscrit(normalizedPhone, message);
      }
  
      // Return success response
      return res.status(201).json({ message: 'Inscription réussie et confirmation envoyée.' });
    } catch (error) {
      console.error('Error during patient signup:', error);
  
    
}
  };
  const signuppatientsavant = async (req, res) => {
    const { email, phone, lastname, name } = req.body;
 if (!name  || !phone) {
      return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }  
    // Validate input
    if (!phone ) {
      return res.status(400).json({ error: 'Le numéro de téléphone et le mot de passe sont requis.' });
    }
  
    try {
      const generatedPassword = generatePassword(); // Ensure this function generates a valid password
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);
  
      // Insert the user into the `users` table
      const userSql =
        'INSERT INTO users (name, lastname, email, phone_number, passwordpatient, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
      const [userResults] = await db.execute(userSql, [name, lastname, email || null, phone, hashedPassword]);
  
      const userId = userResults.insertId; // ID of the newly inserted user
  
      // Insert into the `patients` table
      const insertSql =
        'INSERT INTO patients (user_id, first_name, last_name, phone_number, email, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
      const values = [userId, name, lastname  || null, phone, email || null];
      await db.execute(insertSql, values);
  
      // Prepare the confirmation message
      const message =
        `Bienvenue ${name}!\n` +
        `Vous êtes inscrit chez Wic-Doctor.\n` +
        `Afin d'accéder à votre compte, veuillez trouver votre mot de passe ci-dessous : ${generatedPassword}\n` +
        `Veuillez compléter votre fiche, s'il vous plaît.\n` +
        `Si vous n'avez pas demandé cette inscription, ignorez simplement ce message.\n` +
        `Cordialement,\nL'équipe de Wic-Doctor.`;
  
      // Send confirmation email (if email exists)
      if (email) {
        await sendConfirmationEmail(`${name}`, email, generatedPassword, res, userId);
      }
      if (phone) {
      // Send SMS confirmation
      await sendSMScontactinscrit(phone, message);
      }
      // Return success response
      return res.status(201).json({ message: 'Inscription réussie et confirmation envoyée.' });
    } catch (error) {
        console.error('Error during patient signup:', error);
if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('users_phone_number_unique')) {
            // Renvoyer une erreur spécifique au front-end
            res.status(400).json({
                error: 'Ce numéro de téléphone est déjà utilisé, veuillez en fournir un autre.'

            });      
       } // Environnement de développement : inclure les détails de l'erreur
        const isDevelopment = process.env.NODE_ENV === 'development'; // Assurez-vous que NODE_ENV est configuré
        const errorMessage = isDevelopment ? error.message : 'Une erreur est survenue lors de l\'inscription.';
      
//        return res.status(500).json({ error: errorMessage });
      }
  };
  

 
const ajouterPatient = async (req, res) => {
    try {
      const {
        user_id,
        first_name,
        last_name,
        phone_number,
        mobile_number,
        email,
        age,
        gender,
        weight,
        height,
        medical_history,
        notes,
        antecedent
      } = req.body;
  
      // Vérifier si l'utilisateur existe
      const queryUser = 'SELECT * FROM users WHERE id = ?';
      const [users] = await db.query(queryUser, [user_id]);
  
      if (users.length === 0) {
        return res.status(404).json({ error: 'Utilisateur introuvable.' });
      }
  
      // Ajouter le patient
      const queryPatient = `
        INSERT INTO patients (
          user_id, first_name, last_name, phone_number, mobile_number, age, gender, weight, height,
          medical_history, notes, created_at, updated_at,email,antecedent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(),?,?)
      `;
      const [result] = await db.query(queryPatient, [
        user_id,
        first_name,
        last_name,
        phone_number,
        mobile_number,
        email ,
        age,
        gender,
        weight,
        height,
        medical_history,
        notes,
        antecedent
      ]);
  
      res.status(201).json({ message: 'Patient ajouté avec succès.', patientId: result.insertId });
    } catch (err) {
      console.error('Erreur :', err);
      res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
  }
const obtenirPatientsParUtilisateur = async (req, res) => {
    try {
      const { user_id } = req.params; // Récupérer l'ID utilisateur depuis les paramètres de la requête
  
      // Exécuter la requête SQL
      const query = 'SELECT * FROM patients WHERE user_id = ?';
      const [patients] = await db.query(query, [user_id]);
  
      // Vérifier si des patients existent pour cet utilisateur
      if (patients.length === 0) {
        return res.status(404).json({ message: 'Aucun patient trouvé pour cet utilisateur.' });
      }
  
      // Retourner les résultats
      res.status(200).json({ patients });
    } catch (err) {
      console.error('Erreur lors de la récupération des patients :', err);
      res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
  }
  function sendEmailPaiement(req, res) {
    const { email, htmlContent } = req.body;

    // Validation de l'e-mail et du contenu
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    }

    if (!htmlContent || typeof htmlContent !== 'string') {
        return res.status(400).json({ error: 'Le contenu HTML est requis.' });
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        port: 587,
        secure: false, 
        auth: {
            user: 'laajili.khouloud12@gmail.com', 
            pass: 'lmvy ldix qtgm gbna', // Remplacez ceci par un mot de passe d'application pour plus de sécurité
        },
    });

    const mailOptions = {
        from: 'laajili.khouloud12@gmail.com',
        to: email,
        subject: 'Paiement De Téléconsultation',
        html: htmlContent,
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'e-mail.' });
        } else {
            console.log('Email sent: ' + info.response);
            return res.status(201).json({ message: 'E-mail envoyé avec succès.' });
        }
    });
}



const sendSMS = async (from, to, content) => {
    try {
        // Définir les paramètres de la requête
        const payload = {
            login: 'sender@vats',
            pass: 'qgOX7lHHLmyg7Sn3iWpx',
            compte: 'Vats',
            op: '1',
            customised: '0',
            dest_num: to,
            msg: content,
            type: '0',
            auto_detect: '0',
            dt: new Date().toISOString().split('T')[0],  // Date d'aujourd'hui au format YYYY-MM-DD
            hr: new Date().getHours().toString().padStart(2, '0'),  // Heure actuelle
            mn: new Date().getMinutes().toString().padStart(2, '0'),  // Minute actuelle
            label: 'Vats',
            ref: 'vats-test'
        };

        // Faire la requête HTTP POST à l'API SMS
        const response = await axios.post('https://sms.topnetpro.tn/send/webapi/v3/send_ack.php', null, {
            params: payload
        });

        return response.data;
    } catch (error) {
        throw new Error('Erreur lors de l\'envoi du SMS: ' + error.message);
    }
};

// Contrôleur pour envoyer un SMS
const sendSMSController = async (req, res) => {
    const { from, to, content } = req.body;

    // Validation des paramètres nécessaires
    if (!from || !to || !content) {
        return res.status(400).json({ error: 'Les paramètres "from", "to" et "content" sont requis.' });
    }

    try {
        const result = await sendSMS(from, to, content);

        // Vérifier si le SMS a été envoyé avec succès
        if (result.status === 'success') {
            return res.status(200).json({ message: 'SMS envoyé avec succès' });
        } else {
            return res.status(400).json({ error: 'Erreur lors de l\'envoi du SMS', details: result });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
module.exports = {
getAssurances,sendEmailPaiement,infob2b,    signuppatients,signin,signupb2b,updateprofilpatient,logout,resetPassword , ajouterPatient , obtenirPatientsParUtilisateur , signuppatient 
,sendSMSController
}
  
