const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors'); // Importer cors
const app = express();
const port = 3000;
const db = require('../config/db'); // Importer la connexion à la base de données
app.use(cors());
// Middleware
app.use(bodyParser.json());
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const nodemailer = require('nodemailer');
const crypto = require('crypto');
app.use(express.json());
const { v4: uuidv4 } = require('uuid');
//const moment = require('moment');
const moment = require('moment-timezone');

const cron = require('node-cron');

const SECRET_KEY = 'votre_clé_secrète';

const puppeteer = require('puppeteer');
const path = require('path');

const fs = require('fs'); // Ajout de l'importation fs

const safeJsonParse = (jsonString) => {
    try {
        // Nettoyer la chaîne pour enlever les caractères spéciaux
        const cleanedString = jsonString.replace(/[\x00-\x1F\x7F]/g, '');  // Supprimer les caractères de contrôle
        return JSON.parse(cleanedString);
    } catch (error) {
        console.error("Erreur lors du parsing JSON:", error);
        return null;  // Si le JSON est invalide, retourner null
    }
};
function formatDateToFrench(dateString) {
    const months = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];
    const date = new Date(dateString);
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}


// Configurer body-parser pour les requêtes JSON

// Lire les horaires de chaque  docteur par ID doctor
app.get('/availability/:doctorId', (req, res) => {
    const doctorId = req.params.doctorId;

    const query = `
        SELECT day, start_at, end_at 
        FROM availability_hours 
        WHERE doctor_id = ?`;

    db.query(query, [doctorId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Error retrieving availability hours.' });
        }
        res.json(results);
    });
});
// Lire les détails d'un médecin et de l'utilisateur associé par user_id
app.get('/doctors/user/:userId', (req, res) => {
    const userId = req.params.userId;

    const sql = `
        SELECT doctors.id AS doctor_id, doctors.name AS doctor_name, doctors.description, 
               user.id AS user_id, user.name, user.email
        FROM doctors
        JOIN user ON doctors.user_id = user.id
        WHERE doctors.user_id = ? 
       
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        
        if (results.length === 0) {
            return res.status(404).send('No doctor found for this user ID');
        }

        res.send(results[0]); // On renvoie uniquement le premier résultat
    });
});
//Liste Des Doctors Aléatoirement
app.get('/doctorsliste', (req, res) => {
    const userIds = req.query.user_ids; // Les IDs sont passés en tant que paramètre de requête
    if (!userIds) {
        return res.status(400).json({ error: 'User IDs are required.' });
    }
    const userIdArray = userIds.split(',').map(id => db.escape(id)).join(',');

    const sql = `SELECT * ,  user.id AS user_id, user.name, user.email FROM doctors JOIN user ON doctors.user_id = user.id WHERE user_id IN (${userIdArray})    ORDER BY RAND()`;
    
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

const getbanquesangs = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;  // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [limit, offset]; // Paramètres pour la requête

    try {
        // Requête pour récupérer le nombre total de vétérinaires
        const totalCountQuery = `
        SELECT COUNT(*) AS totalCount
        FROM  banque_sang dt
    `;
    

        // Exécution de la requête pour obtenir le total
        const [totalCountResult] = await db.query(totalCountQuery);
        const total = totalCountResult[0].totalCount;  // Total des vétérinaires

        // Calcul du nombre total de pages
        const totalPages = Math.ceil(total / limit);

        // Requête pour récupérer les vétérinaires avec la pagination
        const queryDocteursTunisie = `
            SELECT 
                dt.Name AS name,
                dt.Phone AS phone_number,
                dt.adresse AS Adresse_exacte,
                dt.gouvernorat AS gouvernorat,
                  dt.pays AS pays 

            FROM 
                 banque_sang dt
            LIMIT ? OFFSET ?
        `;

        // Exécution de la requête
        const [results] = await db.query(queryDocteursTunisie, queryParams);

        // Vérifier s'il y a des résultats
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun vétérinaire trouvé.' });
        }

        // Calcul de la page actuelle
        const currentPage = Math.floor(offset / limit) + 1;

        // Retour des résultats au client avec la pagination
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des vétérinaires:', error);
        return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
};


//Chercher La Lite Des Doctors Par Adresse (en ajoutant attribt vadresse au tabla docotors)
app.get('/doctorsadresse', (req, res) => {
    const addresse = req.query.addresse;

    if (!addresse) {
        return res.status(400).json({ error: 'L\'adresse est requise.' });
    }

    const query = 'SELECT * FROM doctors WHERE adresse LIKE ?';
    db.query(query, [`%${addresse}%`], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
        }
        res.json(results);
    });
});


//Chercher La Lite Des Doctors Par Adresse Passant Par Table Adressses
//app.get('/usersadress', (req, res) => {
  //  const address = req.query.address;

    //if (!address) {
      //  return res.status(400).json({ error: 'L\'adresse est requise.' });
    //}

//    const query = `
  //      SELECT u.*
    //    FROM users u
      //  JOIN doctors d ON u.id = d.user_id
      //  JOIN addresses a ON u.id = a.user_id
     //   WHERE a.address = ?
   // `;

   // db.query(query, [address], (err, results) => {
      //  if (err) {
        //    return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
       // }
       // res.json(results);
   // });
//});
//recherche user par adresse
//app.get('/users', (req, res) => {
    //const address = req.query.address;

  //  if (!address) {
     //   return res.status(400).json({ error: 'L\'adresse est requise.' });
   // }

  //  const query = `
       // SELECT u.*
        //FROM users u
        //JOIN doctors d ON u.id = d.user_id
      //  JOIN addresses a ON u.id = a.user_id
    //    WHERE a.address = ?
   // `;

   // db.query(query, [address], (err, results) => {
       // if (err) {
      //      return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
    //    }
  //      res.json(results);
//    })
app.get('/doctorspecialities', (req, res) => {
    const speciality_id = req.query.speciality_id;

    if (!speciality_id) {
        return res.status(400).json({ error: 'L\'ID de spécialité est requis.' });
    }

    const query = `
        SELECT u.*
        FROM users u
        JOIN doctors d ON u.id = d.user_id
        JOIN doctor_specialities ds ON d.id = ds.doctor_id
        WHERE ds.speciality_id= ?
    `;

    db.query(query, [speciality_id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
        }
        res.json(results);
    });
});

//Chercher La Lite Des Doctors Par Adresse Passant Par Table Adressses et specialité
app.get('/doctorsadd', (req, res) => {
    const speciality_id = req.query.speciality_id;
    const address = req.query.address;

    // Vérifier si au moins l'un des paramètres est fourni
    if (!speciality_id && !address) {
        return res.status(400).json({ error: 'L\'ID de spécialité ou l\'adresse est requis.' });
    }

    let query = `
        SELECT u.*
        FROM users u
        JOIN doctors d ON u.id = d.user_id
    `;
    
    const queryParams = [];

    // Ajout de la jointure pour les spécialités
    if (speciality_id) {
        query += `
            JOIN doctor_specialities ds ON d.id = ds.doctor_id
        `;
    }

    // Ajout de la jointure pour les adresses
    if (address) {
        query += `
            JOIN addresses a ON u.id = a.user_id
        `;
    }

    // Conditions pour la requête
    const conditions = [];
    if (speciality_id) {
        conditions.push('ds.speciality_id = ?');
        queryParams.push(speciality_id);
    }
    if (address) {
        conditions.push('a.address = ?');
        queryParams.push(address);
    }

    // Ajouter les conditions à la requête
    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }

    db.query(query, queryParams, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
        }
        res.json(results);
    });
});

//disponibilité de doctor
app.get('/doctor-availability', (req, res) => {
    const query = `
       SELECT d.name, hd.start_at, hd.end_at , day
        FROM doctors d
        JOIN availability_hours hd ON d.id = hd.doctor_id;
    `;

    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des disponibilités.' });
        }
        res.json(results);
    });
});

//fusion de fontion recherche par adresse , specialité et afficher disponibilité de doctor 
app.get('/doctorsdispo', (req, res) => {
    const speciality_id = req.query.speciality_id;
    const address = req.query.address;

    // Vérifier si au moins l'un des paramètres est fourni
    if (!speciality_id && !address) {
        return res.status(400).json({ error: 'L\'ID de spécialité ou l\'adresse est requis.' });
    }

    let query = `
        SELECT d.name, hd.start_at, hd.end_at, u.id AS user_id
        FROM doctors d
        JOIN availability_hours hd ON d.id = hd.doctor_id
        JOIN users u ON u.id = d.user_id
    `;
    
    const queryParams = [];

    // Ajout de la jointure pour les spécialités
    if (speciality_id) {
        query += `
            JOIN doctor_specialities ds ON d.id = ds.doctor_id
        `;
    }

    // Ajout de la jointure pour les adresses
    if (address) {
        query += `
            JOIN addresses a ON u.id = a.user_id
        `;
    }

    // Conditions pour la requête
    const conditions = [];
    if (speciality_id) {
        conditions.push('ds.speciality_id = ?');
        queryParams.push(speciality_id);
    }
    if (address) {
        conditions.push('a.address = ?');
        queryParams.push(address);
    }

    // Ajouter les conditions à la requête
    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }

    db.query(query, queryParams, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
        }
        res.json(results);
    });
});
//liste des rendez-vous dispo par doctors
app.get('/doctorsdispos', (req, res) => {
    const doctorId = req.query.doctorId;
    

    // Vérifier si au moins l'un des paramètres est fourni
    if (!doctorId) {
        return res.status(400).json({ error: 'L\'ID de spécialité ou l\'adresse est requis.' });
    }
let query = `
      SELECT r.appointment_at , start_at , ends_at 
FROM appointments r
JOIN appointment_statuses s ON r.appointment_status_id = s.id
WHERE r.doctor_id = ? AND s.status = 'failed';
    `;
    db.query(query, [doctorId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
        }
        res.json(results);
    });
});

// Fonction pour ajouter un rendez-vous
app.post('/appointments', (req, res) => {
    const {
        
        clinic,
        doctor,
        doctor_id,
        patient,
        user_id,
        quantity,
        appointment_status_id,
        address,
        payment_id,
        coupon,
        taxes,
        appointment_at,
        start_at,
        ends_at,
        hint,
        online,
        cancel,
    } = req.body;

    const query = `
        INSERT INTO appointments (id,clinic, doctor, doctor_id, patient, user_id, quantity, appointment_status_id, address, payment_id, coupon, taxes, appointment_at, start_at, ends_at, hint, online, cancel, created_at, updated_at)
        VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const values = [
        clinic,
        doctor,
        doctor_id,
        patient,
        user_id,
        quantity,
        appointment_status_id,
        address,
        payment_id,
        coupon,
        taxes,
        appointment_at,
        start_at,
        ends_at,
        hint,
        online,
        cancel,
    ];

    db.query(query, values, (error, results) => {
        if (error) {
            console.error('Error inserting appointment:', error);
            return res.status(500).json({ error: 'Error inserting appointment' });
        }
        res.status(201).json({ message: 'Appointment created successfully', id: results.insertId });
    });
});
app.post('/api/rendez_vous', (req, res) => {
    const { nom, date, description } = req.body;

    // Vérification des données d'entrée
    if (!nom || !date) {
        return res.status(400).send({ message: 'Nom et date sont requis.' });
    }

    const sql = 'INSERT INTO rendez_vous (nom, date, description) VALUES (?, ?, ?)';
    const values = [nom, date, description || null]; // description peut être null

    db.execute(sql, values, (err, results) => {
        if (err) {
            console.error('Erreur lors de l\'ajout du rendez-vous:', err);
            return res.status(500).send({ message: 'Erreur lors de l\'ajout du rendez-vous' });
        }
        res.status(201).send({ message: 'Rendez-vous ajouté avec succès', id: results.insertId });
    });
});



//get all doctors aléatoirement 
const getalldoctorssavant = (req, res) => {
    let query = `
   SELECT  
        d.id AS doctor_id,
        d.name AS name,
        d.doctor_photo,
        d.enable_online_consultation,
        d.description,
        d.horaires,
        d.cabinet_photo,
        d.created_at,
        a.title AS title,
        JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities
      
        addr.ville
  
    FROM 
        doctors d 
    LEFT JOIN 
        doctor_specialities ds ON d.id = ds.doctor_id 
    LEFT JOIN 
        specialities s ON ds.speciality_id = s.id 
    JOIN 
        experiences a ON d.id = a.doctor_id 
    JOIN 
        users usr ON d.user_id = usr.id 
    JOIN 
        addresses addr ON usr.id = addr.user_id 
    GROUP BY  
        d.id, 
        d.name, 
        d.doctor_photo,
        d.enable_online_consultation,
        d.description,
        d.horaires,
        d.cabinet_photo,
        d.created_at,
        a.title,
       
        addr.ville
   ORDER BY RAND()
   `;

    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
        }
        res.json(results);
    });
};
const getalldoctors = async (req, res) => {
    let query = `SELECT  
    d.id AS doctor_id,
    d.name AS name,
    d.doctor_photo,
    d.enable_online_consultation,
    d.description,
    d.horaires,
    d.cabinet_photo,
    d.created_at,
    d.id_aleatoire AS aleatoire,
    a.title AS title,
    JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
    usr.phone_number,  
    addr.ville AS ville,
    addr.pays AS pays,     
    addr.gouvernorat AS gouvernorat,
    addr.address AS adresse_exacte
FROM 
    doctors d 
LEFT JOIN 
    doctor_specialities ds ON d.id = ds.doctor_id 
LEFT JOIN 
    specialities s ON ds.speciality_id = s.id 
LEFT JOIN 
    experiences a ON d.id = a.doctor_id 
LEFT JOIN 
    users usr ON d.user_id = usr.id 
LEFT JOIN 
    addresses addr ON usr.id = addr.user_id
WHERE
    addr.ville IS NOT NULL AND addr.ville != ''  -- Filtrer pour avoir une adresse
GROUP BY  
    d.id, 
    d.name, 
    d.doctor_photo,
    d.enable_online_consultation,
    d.description,
    d.horaires,
    d.cabinet_photo,
    d.created_at,
    d.id_aleatoire,
    a.title,
    usr.phone_number,  
    addr.ville,
    addr.pays,     
    addr.gouvernorat,
    addr.address
ORDER BY 
    RAND();
`;
    try {
        // Execute the query
        const [results] = await db.query(query);

        // Return the results
        res.json(results);
    } catch (err) {
        console.error(err); // For debugging
        return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
    }
};

const getalldoctors66 = async (req, res) => {
    let query = `
//        SELECT  
  //          d.id AS doctor_id,
    //        d.name AS name,
      //      d.doctor_photo,
        //    d.enable_online_consultation,
          //  d.description,
    //        d.horaires,
      //      d.cabinet_photo,
        //    d.created_at,d.id_aleatoire,
          //  a.title AS title,
SELECT  
    d.id AS doctor_id,
    d.name AS name,
    d.doctor_photo,
    d.enable_online_consultation,
    d.description,
    d.horaires,
    d.cabinet_photo,
    d.created_at,
    d.id_aleatoire,
    a.title AS title,
    JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
    usr.phone_number,  
    addr.ville AS ville,
    addr.pays AS pays,     
    addr.gouvernorat AS gouvernorat,
    addr.address AS adresse_exacte
FROM 
    doctors d 
LEFT JOIN 
    doctor_specialities ds ON d.id = ds.doctor_id 
LEFT JOIN 
    specialities s ON ds.speciality_id = s.id 
LEFT JOIN 
    experiences a ON d.id = a.doctor_id 
LEFT JOIN 
    users usr ON d.user_id = usr.id 
LEFT JOIN 
    addresses addr ON usr.id = addr.user_id
WHERE
    addr.ville IS NOT NULL AND addr.ville != ''  -- Filtrer pour avoir une adresse
GROUP BY  
    d.id, 
    d.name, 
    d.doctor_photo,
    d.enable_online_consultation,
    d.description,
    d.horaires,
    d.cabinet_photo,
    d.created_at,
    d.id_aleatoire,
    a.title,
    usr.phone_number,  
    addr.ville,
    addr.pays,     
    addr.gouvernorat,
    addr.address
ORDER BY 
    RAND();
            JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
            usr.phone_number,  
             addr.ville AS ville,
            addr.pays AS pays,     
             addr.gouvernorat AS gouvernorat,
            addr.address AS adresse_exacte
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            experiences a ON d.id = a.doctor_id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
        WHERE
            addr.ville IS NOT NULL AND addr.ville != ''  -- Filtrer pour avoir une adresse
GROUP BY  
            d.id, 
            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,d.id_aleatoire,
            usr.phone_number,  
            addr.ville ,
            addr.pays AS pays,     
             addr.gouvernorat AS gouvernorat,
            addr.address AS adresse_exacte,
        ORDER BY RAND();
    `;
    try {
        // Execute the query
        const [results] = await db.query(query);

        // Return the results
        res.json(results);
    } catch (err) {
        console.error(err); // For debugging
        return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
    }
};
const getalldoctorss = async (req, res) => {
    let query = `
        SELECT  
            d.id AS doctor_id,
            d.name AS name,
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title AS title,
            JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
            usr.phone_number,  
            addr.ville
        FROM 
            doctors d 
      LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            experiences a ON d.id = a.doctor_id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id 
        GROUP BY  
            d.id, 
            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,
            usr.phone_number,  
            addr.ville
        ORDER BY RAND();
    `;

    try {
        // Execute the query
        const [results] = await db.query(query);

        // Return the results
        res.json(results);
    } catch (err) {
        console.error(err); // For debugging
        return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
    }
};


const getDoctorsparvillepaysspecialitess = async (req, res) => {
    const speciality_id = req.query.speciality_id;
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays

    let query = `
     SELECT  
        d.id AS doctor_id,
        d.name AS name,
        d.doctor_photo,
        d.enable_online_coprise-de-rendez-vous.html#nsultation,
        d.description,
        d.horaires,
        d.cabinet_photo,
        d.created_at,
        a.title AS title,
        usr.phone_number,
        addr.ville,
        addr.pays,
        JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities
    FROM 
        doctors d 
    LEFT JOIN 
        doctor_specialities ds ON d.id = ds.doctor_id 
    LEFT JOIN 
        specialities s ON ds.speciality_id = s.id 
    LEFT JOIN 
        experiences a ON d.id = a.doctor_id 
    LEFT JOIN 
        users usr ON d.user_id = usr.id 
    LEFT JOIN 
        addresses addr ON usr.id = addr.user_id
    `;

    const queryParams = [];
    const conditions = [];

    // Condition for speciality
    if (speciality_id) {
        conditions.push('ds.speciality_id = ?');
        queryParams.push(speciality_id);
    }

    // Condition for city (ville)
    if (ville) {
        conditions.push('addr.ville = ?'); 
        queryParams.push(ville);
    }

    // Condition for country (pays)
    if (pays) {
        conditions.push('addr.pays = ?'); 
        queryParams.push(pays);

}
    // Append conditions to the query if any
    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Grouping the results and randomizing the order
    query += `
        GROUP BY  
            d.id, 
            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,
            usr.phone_number, 
            addr.ville,
            addr.pays
        ORDER BY RAND()
    `;

    try {
        const [results] = await db.query(query, queryParams);
        // Check if results were found
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun médecin trouvé avec ces critères.' });
        }
        res.json(results);
    } catch (err) {
        console.error(err); // Debugging
        return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
    }
};

const insertAppointmentteleconsultation= async (req, res) => {
    console.log('Request Body:', req.body); // Affiche le contenu de req.body
    const authHeader = req.headers['authorization'];

    // Vérifier si le header contient le token
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Accès refusé, token manquant' });
    }

    // Récupérer les paramètres depuis le corps de la requête
    const { appointment_at, ends_at, start_at, doctor_id, clinic, doctor, patient, address,motif_id } = req.body;

    // Vérification des paramètres requis
    if (!ends_at || !start_at || !token || !doctor_id  ) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }
let user_id;
try {
    // Vérifier que le token existe avant de tenter de le décoder
    if (!token) {
        return res.status(400).json({ error: 'Token manquant.' });
    }

    // Décoder le token en utilisant jwt.verify
    const decoded = jwt.verify(token, SECRET_KEY);

    // Vérifier que le token décodé contient bien user_id
    if (!decoded || !decoded.user_id) {
        return res.status(400).json({ error: 'Token invalide.' });
    }

    user_id = decoded.user_id;
} catch (error) {
    // Gérer les erreurs spécifiques de jwt.verify
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expiré.' });
    } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token invalide.' });
    } else {
        return res.status(500).json({ error: 'Erreur lors de la vérification du token.' });
    }
}
const insertQuery = `
        INSERT INTO appointments (appointment_at, ends_at, start_at, user_id, doctor_id, clinic, doctor, patient, address, motif_id, appointment_status_id,online) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,55 , 1 ,"Téléconsultation")
    `;
    
    const values = [appointment_at, ends_at, start_at, user_id, doctor_id, clinic, doctor, patient, address, motif_id];

    // Supprimer l'heure disponible associée dans la table 'available_hours'
    const deleteAvailableHourQuery = `
        DELETE FROM availability_hours 
        WHERE doctor_id = ? 
        AND start_at = ? 
        AND end_at = ?
             
    `;
    
    const availableHourValues = [doctor_id, start_at, ends_at];

    try {
        // Supprimer les heures disponibles
        await db.query(deleteAvailableHourQuery, availableHourValues);

        // Insérer le rendez-vous
        const [insertResult] = await db.query(insertQuery, values);

        // Logique d'envoi d'e-mail
        const emailQuery = `SELECT email FROM users WHERE id = ?;`;
        const [userEmail] = await db.query(emailQuery, [user_id]);

const   emaildoc = `SELECT u.email FROM users u  INNER JOIN doctors d ON u.id = d.user_id WHERE d.id = ?;`;
const [docmail] = await db.query(emaildoc,[doctor_id]);

       // const emailpQuery = `SELECT email FROM  WHERE id = ?;`;
       // const [patientmail] = await db.query(emailpQuery, [patient_id]);

        const phoneQuery = `SELECT phone_number FROM users WHERE id = ?;`;
        const [userphone] = await db.query(phoneQuery, [user_id]);

        //const phonepQuery = `SELECT phone_number FROM patients WHERE id = ?;`;
       // const [patientphone] = await db.query(phoneQuery, [patient_id]);
//        if (patientmail.length === 0) {
  //          return res.status(404).json({ message: 'Aucune disponibilité trouvée pour ce médecin.' });
    //       // return patientmail[0].email == userEmail[0] ;
      //  }
        const namedocQuery = `SELECT name FROM doctors WHERE id = ?;`;
        const [docname] = await db.query(namedocQuery, [doctor_id]);
        const nameQuery = `SELECT name FROM users WHERE id = ?;`;
        const [userName] = await db.query(nameQuery, [user_id]);
        if (userEmail.length === 0) {
            return res.status(404).json({ message: 'Aucune mail pour ce user.' });
        }
        const startDate = new Date(start_at);
        const endDate = new Date(ends_at);

       // Fonction pour formater la date
       const formatDate = (date) => {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
        return `le ${date.toLocaleString('fr-FR', options).replace(',', '')}`; // Remplacer la virgule pour obtenir le format désiré
    };
  // Fonction pour formater l'heure
  const formatTime = (date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`; // Formate l'heure et les minutes
};
    const formattedStartAt = formatDate(startDate);
    const formattedStartAt1 = formatTime(endDate);
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            auth: {
                user: 'laajili.khouloud12@gmail.com',
                pass: 'lmvy ldix qtgm gbna', // Utiliser un mot de passe d'application pour plus de sécurité
            },
        });

        const mailOptions = {
            from: 'laajili.khouloud12@gmail.com',
            to: userEmail[0].email,
            subject: 'Confirmation de votre Rendez-vous',
            html: `<html>
            <body>
                <h2 style="color: #4CAF50;">Bienvenue Cher Patient ${userName[0].name}</h2>
                <p>Votre rendez-vous en téléconsultation  avec le médecin  ${JSON.parse(docname[0].name).fr}  ${formattedStartAt} au  ${formattedStartAt1} est bien confirmé</p>
                <p></p>   
                <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
            </body>
            </html>`, // Personnalisez l'e-mail selon vos besoins
};
console.log(docmail[0]);
console.log(docmail[0].email);
const mailOptionss = {
    from: 'laajili.khouloud12@gmail.com',
    to: docmail[0].email,
    subject: 'Confirmation de votre Rendez-vous',
    html: `<html>
    <body>
        <h2 style="color: #4CAF50;">Bienvenue Cher Doctor ${JSON.parse(docname[0].name).fr} </h2>
        <p>Votre avez un rendez-vous en téléconsultation avec  ${userName[0].name}  ${formattedStartAt} au  ${formattedStartAt1} est bien confirmé</p>
        <p></p>   
        <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
    </body>
    </html>`, // Personnalisez l'e-mail selon vos besoins
};

const message = `Bienvenue Cher Patient(e)${userName[0].name}\n` +
`Votre rendez-vous en téléconsultation avec le médecin  ${JSON.parse(docname[0].name).fr}  ${formattedStartAt} au  ${formattedStartAt1}  est bien confirmé` +
`Cordialement,\nL'équipe de Wic-Doctor.`;
if (userEmail[0].email) {
// await sendConfirmationEmail(`${name} ${lastname}`,userEmail[0].email, generatedPassword, res, userId);
await transporter.sendMail(mailOptions);

}
if (docmail[0].email) {
// await sendConfirmationEmail(`${name} ${lastname}`,userEmail[0].email, generatedPassword, res, userId);
await transporter.sendMail(mailOptionss);

}

const normalizedPhone = userphone[0].phone_number.replace(/[^\d]/g, ''); // Supprime tout caractère non numérique

// Send SMS confirmation (if phone exists)
if (userphone[0].phone_number) {
await sendSMScontactinscrit(normalizedPhone, message);
// await sendSMScontactinscrit(userphone[0].phone_number,message);

}
//await transporter.sendMail(mailOptions);

//        await transporter.sendMail(mailOptions);
//      await sendSMScontactinscrit(userphone[0].phone_number,message);
console.log(userphone[0].phone_number);
return res.status(201).json({ message: 'Rendez-vous inséré avec succès', id: insertResult.insertId });
} catch (error) {
console.error('Erreur lors de l\'insertion du rendez-vous ou de l\'envoi de l\'e-mail:', error);
return res.status(500).json({ error: 'Erreur lors de l\'insertion du rendez-vous ou de l\'envoi de l\'e-mail.' });
}
};
const getDoctorsparvillepaysspecialitesss = async (req, res) => {
    const speciality_id = req.query.speciality_id;
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays

    const queryParams = [];
    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    // Conditions for table `doctors`
    let queryDoctors = `
     SELECT  
        d.name AS name,
        d.doctor_photo,
        d.enable_online_consultation,
        d.description,
        d.horaires,
        d.cabinet_photo,
        d.created_at,
        a.title AS title,
        usr.phone_number,
        addr.ville,
        addr.pays,
        JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities
    FROM 
        doctors d 
    LEFT JOIN 
        doctor_specialities ds ON d.id = ds.doctor_id 
    LEFT JOIN 
        specialities s ON ds.speciality_id = s.id 
    LEFT JOIN 
        experiences a ON d.id = a.doctor_id 
    LEFT JOIN 
        users usr ON d.user_id = usr.id 
    LEFT JOIN 
        addresses addr ON usr.id = addr.user_id
    `;

    if (speciality_id) {
        conditionsDoctors.push('ds.speciality_id = ?');
        queryParams.push(speciality_id);
    }

    if (ville) {
        conditionsDoctors.push('addr.ville LIKE ?');
        queryParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDoctors.push('addr.pays LIKE ?');
        queryParams.push(`%${pays}%`);
    }

    if (conditionsDoctors.length > 0) {
        queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
    }

    queryDoctors += `
        GROUP BY  
            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,
            usr.phone_number, 
            addr.ville,
            addr.pays
    `;

    // Conditions for table `docteurs_tunisie`
    let queryDocteursTunisie = `
    SELECT 
        dt.name AS name,
        NULL AS doctor_photo,
        NULL AS enable_online_consultation,
        NULL AS description,
        NULL AS horaires,
        NULL AS cabinet_photo,
        NULL AS created_at,
        NULL AS title,
        dt.Phone AS phone_number,
        dt.adresse AS ville,
        dt.Location AS pays,
        dt.Sector AS specialities
    FROM 
        docteurs_tunisie dt
    `;

    if (ville) {
        conditionsDocteursTunisie.push('dt.adresse LIKE ?');
        queryParams.push(`%${ville}%`); // Partial match for city
    }


    if (pays) {
        conditionsDocteursTunisie.push('dt.Location LIKE ?');
        queryParams.push(`%${pays}%`);
    }

    if (conditionsDocteursTunisie.length > 0) {
        queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
    }

    // Combine both queries with UNION ALL
    const finalQuery = `
        (${queryDoctors})
        UNION ALL
        (${queryDocteursTunisie})
        ORDER BY RAND()
    `;

    try {
        const [results] = await db.query(finalQuery, queryParams);
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun médecin trouvé avec ces critères.' });
        }
        res.json(results);
    } catch (err) {
        console.error(err); // Debugging
        return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
    }
};
const getDoctorsparvillepaysspecialitestemchy= async (req, res) => {
    const speciality_id = req.query.speciality_id; // Nom de la spécialité
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays
const limit = parseInt(req.query.limit) || 10; // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    // Conditions for table `doctors`
    let queryDoctors = `
     SELECT  
        d.name AS name,
        d.doctor_photo,
        d.enable_online_consultation,
        d.description,
        d.horaires,
        d.cabinet_photo,
        d.created_at,
        a.title AS title,
        usr.phone_number,
        addr.ville,
        addr.pays,
        JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities
    FROM 
        doctors d 
    LEFT JOIN 
        doctor_specialities ds ON d.id = ds.doctor_id 
    LEFT JOIN 
        specialities s ON ds.speciality_id = s.id 
    LEFT JOIN 
        experiences a ON d.id = a.doctor_id 
    LEFT JOIN 
        users usr ON d.user_id = usr.id 
    LEFT JOIN 
        addresses addr ON usr.id = addr.user_id
    `;

    if (speciality_id) {
        conditionsDoctors.push('s.name LIKE ?');
        queryParams.push(`%${speciality_id}%`); // Partial match for speciality name
    }

    if (ville) {
        conditionsDoctors.push('addr.ville LIKE ?');
        queryParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDoctors.push('addr.pays LIKE ?');
        queryParams.push(`%${pays}%`);
    }

    if (conditionsDoctors.length > 0) {
        queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
    }

    queryDoctors += `
        GROUP BY  
            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,
            usr.phone_number, 
            addr.ville,
            addr.pays
    `;

    // Conditions for table `docteurs_tunisie`
    let queryDocteursTunisie = `
    SELECT 
        dt.name AS name,
        NULL AS doctor_photo,
        NULL AS enable_online_consultation,
        NULL AS description,
        NULL AS horaires,
        NULL AS cabinet_photo,
        NULL AS created_at,
        NULL AS title,
        dt.Phone AS phone_number,
        dt.adresse AS ville,
        dt.Location AS pays,
        dt.Sector AS specialities
    FROM 
        docteurs_tunisie dt
    `;

    if (speciality_id) {
        conditionsDocteursTunisie.push('dt.Sector LIKE ?');
        queryParams.push(`%${speciality_id}%`); // Partial match for speciality name
    }

    if (ville) {
        conditionsDocteursTunisie.push('dt.adresse LIKE ?');
        queryParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDocteursTunisie.push('dt.Location LIKE ?');
        queryParams.push(`%${pays}%`);
    }

    if (conditionsDocteursTunisie.length > 0) {
        queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
    }

    // Combine both queries with UNION ALL
    const finalQuery = `
        (${queryDoctors})
        UNION ALL
        (${queryDocteursTunisie})
        ORDER BY RAND()
    `;

    try {
        const [results] = await db.query(finalQuery, queryParams);
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun médecin trouvé avec ces critères.' });
        }
        res.json(results);
    } catch (err) {
        console.error(err); // Debugging
        return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
    }
};
const getDoctorsparvillepaysspecialitesbon = async (req, res) => {
    const speciality_id = req.query.speciality_id; // Nom de la spécialité
    const ville = req.query.ville; // Ville const pays = req.query.pays; // Pays
    const limit = parseInt(req.query.limit) || 10; // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const countParams = [];

    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    // Requête pour la table `doctors`
    let queryDoctors = `
        SELECT  
            d.name AS name,
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title AS title,
            usr.phone_number,
            addr.ville,
            addr.pays,
            JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
            'conventionné' AS type
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            experiences a ON d.id = a.doctor_id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
    `;

    if (speciality_id) {
        conditionsDoctors.push('s.name LIKE ?');
        queryParams.push(`%${speciality_id}%`); // Correspondance partielle
    }

    if (ville) {
        conditionsDoctors.push('addr.ville LIKE ?');
        queryParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDoctors.push('addr.pays LIKE ?');
        queryParams.push(`%${pays}%`);
    }

    if (conditionsDoctors.length > 0) {
        queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
    }

    queryDoctors += `
        GROUP BY  
            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,
            usr.phone_number, 
            addr.ville,
            addr.pays
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset); // Ajout des paramètres de pagination

    // Requête pour la table `docteurs_tunisie`
    let queryDocteursTunisie = `
        SELECT 
            dt.name AS name,
            NULL AS doctor_photo,
            NULL AS enable_online_consultation,
            NULL AS description,
            NULL AS horaires,
            NULL AS cabinet_photo,
            NULL AS created_at,
            NULL AS title,
            dt.Phone AS phone_number,
            dt.adresse AS ville,
            dt.Location AS pays,
            dt.Sector AS specialities,
            'non-conventionné' AS type
        FROM 
            docteurs_tunisie dt
    `;

    if (speciality_id) {
        conditionsDocteursTunisie.push('dt.Sector LIKE ?');
        queryParams.push(`%${speciality_id}%`); // Correspondance partielle
    }

    if (ville) {
        conditionsDocteursTunisie.push('dt.adresse LIKE ?');
        queryParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDocteursTunisie.push('dt.Location LIKE ?');
        queryParams.push(`%${pays}%`);
    }

    if (conditionsDocteursTunisie.length > 0) {
        queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
    }

    queryDocteursTunisie += `
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset); // Ajout des paramètres de pagination

    // Combinaison des deux requêtes avec UNION ALL
    const finalQuery = `
        (
            ${queryDoctors}
        )
        UNION ALL
        (
            ${queryDocteursTunisie}
        )
        ORDER BY RAND()
    `;

    try {
        const [results] = await db.query(finalQuery, queryParams);
        console.log(queryParams); // Vérifiez la sortie de la requête SQL et des paramètres

        // Vérifier s'il y a des résultats
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun médecin trouvé avec ces critères.' });
        }

        // Calcul du total pour la table `doctors`
        let countDoctors = `
        SELECT COUNT(DISTINCT d.id) AS total
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
        WHERE 1=1
            ${speciality_id ? 'AND s.name LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
        `;
        
        // Calcul du total pour la table `docteurs_tunisie`
        let countDocteursTunisie = `
        SELECT COUNT(*) AS total
        FROM docteurs_tunisie dt 
        WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.adresse LIKE ?' : ''}
            ${pays ? 'AND dt.Location LIKE ?' : ''}
        `;

        const countQueryParams = [
            speciality_id ? `%${speciality_id}%` : null,
            ville ? `%${ville}%` : null,
            pays ? `%${pays}%` : null
        ].filter(Boolean);  // On filtre les valeurs nulles pour ne pas inclure de paramètres inutiles

        const totalDoctors = await db.query(countDoctors, countQueryParams);
        const totalDocteursTunisie = await db.query(countDocteursTunisie, countQueryParams);

        const total = totalDoctors[0].total + totalDocteursTunisie[0].total;
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;

        // Retour des résultats avec pagination
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });

    } catch (err) {
        console.error('Erreur lors de la récupération des médecins:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
    }
};
const getDoctorsparvillepaysspecialitesfinale= async (req, res) => {
    const speciality_id = req.query.speciality_id; // Nom de la spécialité
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays
    const limit = parseInt(req.query.limit) || 10; // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const countParams = [];

    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    // Requête pour la table `doctors`
    let queryDoctors = `
        SELECT  
            d.name AS name,
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title AS title,
            usr.phone_number,
            addr.ville,
            addr.pays,
            JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
            'conventionné' AS type
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            experiences a ON d.id = a.doctor_id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
    `;

    if (speciality_id) {
        conditionsDoctors.push('s.name LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDoctors.push('addr.ville LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
    if (row.holiday_from && row.holiday_to) {
                const holidayKey = `${row.holiday_from}-${row.holiday_to}-${row.holiday_type}-${row.holiday_reason}`;
                if (!holidaysSet.has(holidayKey)) {
                    holidaysSet.add(holidayKey);
                    formattedResults.holidays.push({
                        start: row.holiday_from,
                        ends: row.holiday_to,
                        type: row.holiday_type || null,
                        reason: row.holiday_reason || null,
                    });
                }
            }        conditionsDoctors.push('addr.pays LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }

    if (conditionsDoctors.length > 0) {
        queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
    }

    queryDoctors += `
        GROUP BY  
            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,
            usr.phone_number, 
            addr.ville,
            addr.pays
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Requête pour la table `docteurs_tunisie`
    let queryDocteursTunisie = `
        SELECT 
            dt.name AS name,
            NULL AS doctor_photo,
            NULL AS enable_online_consultation,
            NULL AS description,
            NULL AS horaires,
            NULL AS cabinet_photo,
            NULL AS created_at,
            NULL AS title,
            dt.Phone AS phone_number,
            dt.adresse AS ville,
            dt.Location AS pays,
            dt.Sector AS specialities,
            'non-conventionné' AS type
        FROM 
            docteurs_tunisie dt
    `;

    if (speciality_id) {
        conditionsDocteursTunisie.push('dt.Sector LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDocteursTunisie.push('dt.adresse LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDocteursTunisie.push('dt.Location LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }

    if (conditionsDocteursTunisie.length > 0) {
        queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
    }

    queryDocteursTunisie += `
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Combinaison des deux requêtes avec UNION ALL
    const finalQuery = `
        (
            ${queryDoctors}
        )
        UNION ALL
        (
            ${queryDocteursTunisie}
        )
        ORDER BY RAND()
    `;

    try {
        console.log("Final query with params:", finalQuery, queryParams);
        const [results] = await db.query(finalQuery, queryParams);
        
        // Vérification des résultats
        console.log("Results found:", results);
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun médecin trouvé avec ces critères.' });
        }
    
        // Comptage pour la table `doctors`
        let countDoctors = `
        SELECT COUNT(DISTINCT d.id) AS total
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
        WHERE 1=1
            ${speciality_id ? 'AND s.name LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
        `;
        
        // Comptage pour la table `docteurs_tunisie`
        let countDocteursTunisie = `
        SELECT COUNT(*) AS total
        FROM docteurs_tunisie dt 
        WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.adresse LIKE ?' : ''}
            ${pays ? 'AND dt.Location LIKE ?' : ''}
        `;
    
        console.log("Count query params:", countParams);
    
        // Exécution des requêtes de comptage
        const [doctorsCountResult] = await db.query(countDoctors, countParams);
        const [docteursTunisieCountResult] = await db.query(countDocteursTunisie, countParams);
    
        // Extraction des totaux
        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;
    
        const total = totalDoctors + totalDocteursTunisie;
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;
    
        // Vérification des résultats du calcul
        console.log("Total doctors:", total);
        console.log("Total pages:", totalPages);
    
        // Retour des résultats avec pagination
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    
    } catch (err) {
        console.error('Erreur lors de la récupération des médecins:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
    }
    
};


const getDoctorsparvillepaysspecialitespa = async (req, res) => {
    const speciality_id = req.query.speciality_id; // Nom de la spécialité
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays
    const limit = parseInt(req.query.limit) || 10; // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const countParams = [];

    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    // Requête pour la table `doctors`
    let queryDoctors = `
        SELECT  
            d.name AS name,
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title AS title,
            usr.phone_number,
            addr.ville,
            addr.pays,
            JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
            'conventionné' AS type
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            experiences a ON d.id = a.doctor_id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
    `;

    if (speciality_id) {
        conditionsDoctors.push('s.name LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDoctors.push('addr.ville LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDoctors.push('addr.pays LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }

    if (conditionsDoctors.length > 0) {
        queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
    }

    queryDoctors += `
        GROUP BY  
            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,
            usr.phone_number, 
            addr.ville,
            addr.pays
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Requête pour la table `docteurs_tunisie`
    let queryDocteursTunisie = `
        SELECT 
            dt.name AS name,
            NULL AS doctor_photo,
            NULL AS enable_online_consultation,
            NULL AS description,
            NULL AS horaires,
            NULL AS cabinet_photo,
            NULL AS created_at,
            NULL AS title,
            dt.Phone AS phone_number,
            dt.adresse AS ville,
            dt.Location AS pays,
            dt.Sector AS specialities,
            'non-conventionné' AS type
        FROM 
            docteurs_tunisie dt
    `;

    if (speciality_id) {
        conditionsDocteursTunisie.push('dt.Sector LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDocteursTunisie.push('dt.adresse LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDocteursTunisie.push('dt.Location LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }

    if (conditionsDocteursTunisie.length > 0) {
        queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
    }

    queryDocteursTunisie += `
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Combinaison des deux requêtes avec UNION ALL
    const finalQuery = `
        (
            ${queryDoctors}
        )
        UNION ALL
        (
            ${queryDocteursTunisie}
        )
        ORDER BY RAND()
    `;

    try {
        console.log("Final query with params:", finalQuery, queryParams);
        const [results] = await db.query(finalQuery, queryParams);
        
        // Comptage pour les deux sources
        const countDoctors = `
        SELECT COUNT(DISTINCT d.id) AS total
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
        WHERE 1=1
            ${speciality_id ? 'AND s.name LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
        `;
        
        const countDocteursTunisie = `
        SELECT COUNT(*) AS total
        FROM docteurs_tunisie dt 
        WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.adresse LIKE ?' : ''}
            ${pays ? 'AND dt.Location LIKE ?' : ''}
        `;

        const [doctorsCountResult] = await db.query(countDoctors, countParams);
        const [docteursTunisieCountResult] = await db.query(countDocteursTunisie, countParams);

        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;
        const total = totalDoctors + totalDocteursTunisie;

        if (offset >= (total- 10)) {
            return res.status(404).json({
                message: "Offset invalide.",
                total,
                data: []
            });
        }
if((offset < (total -10)) < 10){
     totalPages = Math.ceil(total / limit) -1;
}
   //     const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;

        return res.json({
            total,
            totalPages,
            currentPage,
            data: results
        });

    } catch (err) {
        console.error('Erreur lors de la récupération des médecins:', err);
        return res.status(500).json({ error: 'Erreur serveur.' });
    }
};
const getDoctorsparvillepaysspecialitestemchyy = async (req, res) => {
    const speciality_id = req.query.speciality_id; // Nom de la spécialité
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays
    const limit = 10; // Fixé à 10 résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const countParams = [];

    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    // Requête pour la table `doctors`
    let queryDoctors = `
        SELECT  
            d.name AS name,
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title AS title,
            usr.phone_number,
            addr.ville,
            addr.pays,
            JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
            'conventionné' AS type
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            experiences a ON d.id = a.doctor_id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
    `;

    if (speciality_id) {
        conditionsDoctors.push('s.name LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDoctors.push('addr.ville LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDoctors.push('addr.pays LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }

    if (conditionsDoctors.length > 0) {
        queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
    }

    queryDoctors += `
        GROUP BY  
            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,
            usr.phone_number, 
            addr.ville,
            addr.pays
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Requête pour la table `docteurs_tunisie`
    let queryDocteursTunisie = `
        SELECT 
            dt.name AS name,
            NULL AS doctor_photo,
            NULL AS enable_online_consultation,
            NULL AS description,
            NULL AS horaires,
            NULL AS cabinet_photo,
            NULL AS created_at,
            NULL AS title,
            dt.Phone AS phone_number,
            dt.adresse AS ville,
            dt.Location AS pays,
            dt.Sector AS specialities,
            'non-conventionné' AS type
        FROM 
            docteurs_tunisie dt
    `;

    if (speciality_id) {
        conditionsDocteursTunisie.push('dt.Sector LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDocteursTunisie.push('dt.adresse LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDocteursTunisie.push('dt.Location LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }

    if (conditionsDocteursTunisie.length > 0) {
        queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
    }

    queryDocteursTunisie += `
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Combinaison des deux requêtes avec UNION ALL
    const finalQuery = `
        (
            ${queryDoctors}
        )
        UNION ALL
        (
            ${queryDocteursTunisie}
        )
        ORDER BY RAND()
    `;

    try {
        const [results] = await db.query(finalQuery, queryParams);

        // Comptage des totaux
        const countDoctors = `
            SELECT COUNT(DISTINCT d.id) AS total
            FROM 
                doctors d 
            LEFT JOIN 
                doctor_specialities ds ON d.id = ds.doctor_id 
            LEFT JOIN 
                specialities s ON ds.speciality_id = s.id 
            LEFT JOIN 
                users usr ON d.user_id = usr.id 
            LEFT JOIN 
                addresses addr ON usr.id = addr.user_id
            WHERE 1=1
                ${speciality_id ? 'AND s.name LIKE ?' : ''}
                ${ville ? 'AND addr.ville LIKE ?' : ''}
                ${pays ? 'AND addr.pays LIKE ?' : ''}
        `;
        
        const countDocteursTunisie = `
            SELECT COUNT(*) AS total
            FROM docteurs_tunisie dt 
            WHERE 1=1
                ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
                ${ville ? 'AND dt.adresse LIKE ?' : ''}
                ${pays ? 'AND dt.Location LIKE ?' : ''}
        `;

        const [doctorsCountResult] = await db.query(countDoctors, countParams);
        const [docteursTunisieCountResult] = await db.query(countDocteursTunisie, countParams);

        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;
        const total = totalDoctors + totalDocteursTunisie;

         // Calcul de la pagination
        // let totalPages = Math.ceil(total / limit);

         // Validation pour éviter les pages vides
       //  if (offset >= total && total > 0) {
       //      offset = (totalPages - 1) * limit; // Ajuster à la dernière page valide
      //   }
      //   if (offset >= total) {
        //    offset = (totalPages - 1) * limit;
      //  }
        // const currentPage = Math.floor(offset / limit) + 1;
 
      //   const totalPages = Math.ceil(total / limit);
      const totalPages = total % limit === 0 ? total / limit : Math.ceil(total / limit);

         // Assurez-vous que l'offset n'est pas supérieur à la dernière page
         if (offset >= total || offset == 0) {
             offset = Math.max((totalPages - 1) * limit, 0);
         }
 
         // Calcul de la page actuelle (1-indexed)
         const currentPage = Math.floor(offset / limit) + 1;
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results
        });

    } catch (err) {
        console.error('Erreur lors de la récupération des médecins:', err);
        return res.status(500).json({ error: 'Erreur serveur.' });
    }
};
const getDoctorsparvillepaysspecialitesofff = async (req, res) => {
    const speciality_id = req.query.speciality_id; // Nom de la spécialité
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays
    const limit = 10; // Nombre fixe de résultats par page
    let offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const countParams = [];

    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    // Calcul initial des totaux pour les deux tables
    const countDoctors = `
        SELECT COUNT(DISTINCT d.id) AS total
        FROM doctors d 
        LEFT JOIN doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN specialities s ON ds.speciality_id = s.id 
        LEFT JOIN users usr ON d.user_id = usr.id 
        LEFT JOIN addresses addr ON usr.id = addr.user_id
        WHERE 1=1
            ${speciality_id ? 'AND s.name LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
    `;
    
    const countDocteursTunisie = `
        SELECT COUNT(*) AS total
        FROM docteurs_tunisie dt 
        WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.adresse LIKE ?' : ''}
            ${pays ? 'AND dt.Location LIKE ?' : ''}
    `;

    countParams.push(...queryParams);

    try {
        // Récupération des totaux
        const [doctorsCountResult] = await db.query(countDoctors, countParams);
        conmailOptionsst [docteursTunisieCountResult] = await db.query(countDocteursTunisie, countParams);

        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;
        const total = totalDoctors + totalDocteursTunisie;

        // Calcul de la pagination
        let totalPages = Math.ceil(total / limit);

        // Validation pour éviter les pages vides
        if (offset >= total && total > 0) {
            offset = (totalPages - 1) * limit; // Ajuster à la dernière page valide
        }

        const currentPage = Math.floor(offset / limit) + 1;

        // Construire la requête avec pagination correcte
        const queryDoctors = `
            SELECT 
                d.name AS name, d.doctor_photo, 
                d.enable_online_consultation, d.description, 
                addr.ville, addr.pays
            FROM doctors d
            LEFT JOIN addresses addr ON d.user_id = addr.user_id
            WHERE 1=1
            ${conditionsDoctors.join(' AND ')}
            LIMIT ? OFFSET ?
        `;

        queryParams.push(limit, offset);

        const finalQuery = `
            (
                ${queryDoctors}
            )
            UNION ALL
            (
                SELECT 
                dt.name, null AS doctor_photo, null AS enable_online_consultation, null AS description, 
                dt.adresse, dt.Location
                FROM docteurs_tunisie dt
                LIMIT ? OFFSET ?
            )
            ORDER BY RAND()
        `;

        // Requête des données
        const [results] = await db.query(finalQuery, queryParams);

        return res.json({
            total,
            totalPages,
            currentPage,
            data: results
        });

    } catch (err) {
        console.error('Erreur serveur:', err);
        return res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
};

const getDoctorsparvillepaysspecialitestmchy = async (req, res) => {
    const speciality_id = req.query.speciality_id;
    const ville = req.query.ville;
    const pays = req.query.pays;
    const limit = 10; 
    const offset = parseInt(req.query.offset) || 0;
    const queryParams = [];
    const countParams = [];

    try {
        // Comptage total
        const countDoctorsQuery = `
            SELECT COUNT(DISTINCT d.id) AS total
            FROM doctors d
            LEFT JOIN addresses addr ON d.user_id = addr.user_id
            WHERE 1=1
            ${speciality_id ? 'AND d.speciality LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
        `;

        const countDocteursTunisieQuery = `
            SELECT COUNT(*) AS total
            FROM docteurs_tunisie dt
            WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.adresse LIKE ?' : ''}
            ${pays ? 'AND dt.Location LIKE ?' : ''}
        `;

        const [doctorsCountResult] = await db.query(countDoctorsQuery, countParams);
        const [docteursTunisieCountResult] = await db.query(countDocteursTunisieQuery, countParams);

        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;
        const total = totalDoctors + totalDocteursTunisie;

        // Pagination
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;

        // Requête principale : sans limite interne dans chaque sous-requête
        const queryDoctors = `
            SELECT d.name, d.doctor_photo, d.enable_online_consultation, addr.ville, addr.pays
            FROM doctors d
            LEFT JOIN addresses addr ON d.user_id = addr.user_id
            WHERE 1=1
        `;

        const queryDocteursTunisie = `
            SELECT dt.name, NULL AS doctor_photo, NULL AS enable_online_consultation, dt.adresse AS ville, dt.Location AS pays
            FROM docteurs_tunisie dt
            WHERE 1=1
        `;

        // Appliquer limit globalement
        const finalQuery = `
            (${queryDoctors})
            UNION ALL
            (${queryDocteursTunisie})
            ORDER BY RAND()
            LIMIT ${limit} OFFSET ${offset}
        `;

        const [results] = await db.query(finalQuery, queryParams);

        return res.json({
            total,
            totalPages,
            currentPage,
            data: results
        });

    } catch (err) {
        console.error('Erreur serveur:', err);
        return res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
};

const getDoctorsparvillepaysspecialites = async (req, res) => {
    const speciality_id = req.query.speciality_id; // Nom de la spécialité
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays
    const gouvernorat = req.query.gouvernorat; // Gouvernorat
    const doctor_name = req.query.doctor_name; // Nom du médecin
    const limit = parseInt(req.query.limit) || 10; // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const countParams = [];
    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];


    // Requête pour la table `doctors`
    let queryDoctors = `
        SELECT  
            d.id AS id_doctor,
            d.name AS name,
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title AS title,
            usr.phone_number,d.id_aleatoire AS aleatoire,
            addr.ville AS ville,
            addr.pays AS pays,     
             addr.gouvernorat AS gouvernorat,
            addr.address AS adresse_exacte,
            JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
            'conventionné' AS type
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            experiences a ON d.id = a.doctor_id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
    `;

    // Conditions pour la table `doctors`
    if (speciality_id) {
        conditionsDoctors.push('s.name LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDoctors.push('addr.ville LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDoctors.push('addr.pays LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }

    if (doctor_name) {
        conditionsDoctors.push('d.name LIKE ?');
        queryParams.push(`%${doctor_name}%`);
        countParams.push(`%${doctor_name}%`);
    }
    if (gouvernorat) {
        conditionsDoctors.push('addr.gouvernorat LIKE ?');
        queryParams.push(`%${gouvernorat}%`);
        countParams.push(`%${gouvernorat}%`);
    }

    if (conditionsDoctors.length > 0) {
        queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
    }

    queryDoctors += `
        GROUP BY  
            d.id,
            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,d.id_aleatoire,
            usr.phone_number, 
            addr.ville,
            addr.pays, 
             addr.gouvernorat,
            addr.address
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Requête pour la table `docteurs_tunisie`
    let queryDocteursTunisie = `
        SELECT 
            NULL AS id_doctor,
            dt.name AS name,
            NULL AS doctor_photo,
            NULL AS enable_online_consultation,
            NULL AS description,
            NULL AS horaires,
            NULL AS cabinet_photo,
            NULL AS created_at,
            NULL AS title,dt.id_aleatoire AS aleatoire,
            dt.Phone AS phone_number,
            dt.adresse AS adresse_exacte,
            dt.gouvernorat AS gouvernorat,
            dt.ville AS ville,
            dt.Sector AS specialites,
            dt.Pays AS pays ,
            'non-conventionné' AS type
        FROM 
            docteurs_tunisie dt
    `;

    // Conditions pour la table `docteurs_tunisie`
    if (speciality_id) {
        conditionsDocteursTunisie.push('dt.Sector LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDocteursTunisie.push('dt.ville LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDocteursTunisie.push('dt.Pays LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }

    if (doctor_name) {
        conditionsDocteursTunisie.push('dt.name LIKE ?');
        queryParams.push(`%${doctor_name}%`);
        countParams.push(`%${doctor_name}%`);
    }
    if (gouvernorat) {
        conditionsDocteursTunisie.push('dt.gouvernorat LIKE ?');
        queryParams.push(`%${gouvernorat}%`);
        countParams.push(`%${gouvernorat}%`);
    }
    if (conditionsDocteursTunisie.length > 0) {
        queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
    }

    queryDocteursTunisie += `
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    try {
        // Exécution des requêtes séparées
        const [resultsDoctors] = await db.query(queryDoctors, queryParams);
        const [resultsDocteursTunisie] = await db.query(queryDocteursTunisie, queryParams);

        // Combinez et filtrez les résultats comme dans votre code original
        let results = [...resultsDoctors, ...resultsDocteursTunisie];

        results = results.filter(result => {
            // Filtrer les médecins "Demo Doctor"
            if (result.name && result.name.toLowerCase().includes('demo doctor')) {
                return false;
            }
            if (!result.ville || !result.pays) {
                return false;
            }
            return true;
        });

        // Formatage et pagination
        results.forEach(result => {
            if (result.specialities && typeof result.specialities === 'string') {
                try {
                    result.specialities = JSON.parse(result.specialities);
                } catch {
                    result.specialities = [];
                }
            }
        });
        let countDoctors = `
        SELECT COUNT(DISTINCT d.id) AS total
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
        WHERE 1=1
            ${speciality_id ? 'AND s.name LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
            ${doctor_name ? 'AND d.name LIKE ?' : ''}
           ${gouvernorat ? 'AND addr.gouvernorat LIKE ?' : ''}

        `;
        
        // Comptage pour la table `docteurs_tunisie`
        let countDocteursTunisie = `
        SELECT COUNT(*) AS total
        FROM docteurs_tunisie dt 
        WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.ville LIKE ?' : ''}
              ${pays ? 'AND dt.pays LIKE ?' : ''} 
     ${doctor_name ? 'AND dt.Name LIKE ?' : ''}
                ${gouvernorat ? 'AND dt.gouvernorat LIKE ?' : ''}

`;
        // Comptage total
        const [doctorsCountResult] = await db.query(countDoctors, countParams);
        const [docteursTunisieCountResult] = await db.query(countDocteursTunisie, countParams);

        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;

        const total = totalDoctors + totalDocteursTunisie;
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;

        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });

    } catch (err) {
        console.error('Erreur lors de la récupération des médecins:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
    }
};
const getDoctorsparvillepaysspecialitessansville = async (req, res) => {
    const speciality_id = req.query.speciality_id; // Nom de la spécialité
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays
    const limit = parseInt(req.query.limit) || 10; // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const countParams = [];
    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    // Requête pour la table `doctors`
    let queryDoctors = `
        SELECT
d.id AS doctor_id,
            d.name AS name,
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title AS title,d.id_aleatoire AS aleatoire ,
            usr.phone_number,
            addr.ville,
            addr.pays,
            addr.address AS adresse_exacte,
            JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
            'conventionné' AS type
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            experiences a ON d.id = a.doctor_id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
          

    `;

    if (speciality_id) {
        conditionsDoctors.push('s.name LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDoctors.push('addr.ville LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDoctors.push('addr.pays LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }
   
    if (conditionsDoctors.length > 0) {
        queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
    }

    queryDoctors += `
        GROUP BY  
        d.id,

            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,d.id_aleatoire,
            usr.phone_number, 
            addr.ville,
            addr.pays, 
            addr.address
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Requête pour la table `docteurs_tunisie`
    let queryDocteursTunisie = `
        SELECT 
        id AS doctor_id ,

            dt.name AS name,
            NULL AS doctor_photo,
            NULL AS enable_online_consultation,
            NULL AS description,
            NULL AS horaires,
            NULL AS cabinet_photo,
            NULL AS created_at,
            dt.Location AS ville,
            dt.Phone AS phone_number,
            dt.id_aleatoire AS aleatoire ,
            dt.Pays AS pays,
            dt.adresse AS adresse_exacte,

            dt.Sector AS specialites ,
            'non-conventionné' AS type
        FROM 
            docteurs_tunisie dt
    `;
  
    if (speciality_id) {
        conditionsDocteursTunisie.push('dt.Sector LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDocteursTunisie.push('dt.Location LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDocteursTunisie.push('dt.Pays LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }

    if (conditionsDocteursTunisie.length > 0) {
        queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
    }

    queryDocteursTunisie += `
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    try {
        // Exécution des requêtes séparées
        const [resultsDoctors] = await db.query(queryDoctors, queryParams);
        const [resultsDocteursTunisie] = await db.query(queryDocteursTunisie, queryParams);
        
        // Combiner les résultats
        let results = [...resultsDoctors, ...resultsDocteursTunisie];

        // Filtrer les résultats : ignorer les médecins nommés "demo" sans adresse
        results = results.filter(result => {
            let doctorName = '';
        
            // Si le champ 'name' est une chaîne JSON, essayer de la parser
            try {
                const nameObj = JSON.parse(result.name); // Parse la chaîne JSON
                doctorName = nameObj.fr || ''; // Récupérer le nom en français
            } catch (err) {
                // Si parsing échoue, doctorName reste une chaîne vide
                console.error('Erreur de parsing du nom du médecin:', err);
            }
        
            // Exclure les médecins dont le nom est "Demo Doctor"
           // if (doctorName.toLowerCase() === "demo doctor") {
             //   return false; // Ne pas afficher ce médecin
           // }
            if (!result.ville || !result.pays || result.ville.trim() === "" || result.pays.trim() === "") {
                return false; // Ne pas afficher ce médecin si ville ou pays sont invalides
           }
            return true;
        });
        
       
        // Formatage des spécialités en tableau JSON
        results.forEach(result => {
            if (result.specialities) {
                try {
                    if (typeof result.specialities === 'string') {
                        result.specialities = JSON.parse(result.specialities);
                    }
                } catch (err) {
                    console.error('Erreur de parsing JSON pour les spécialités:', err);
                    result.specialities = [];  // Remplace par un tableau vide en cas d'erreur
                }
            }
        });
        
        // Comptage pour la table `doctors`
        let countDoctors = `
        SELECT COUNT(DISTINCT d.id) AS total
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
        WHERE 1=1
            ${speciality_id ? 'AND s.name LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
        `;
        
        // Comptage pour la table `docteurs_tunisie`
        let countDocteursTunisie = `
        SELECT COUNT(*) AS total
        FROM docteurs_tunisie dt 
        WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.Location LIKE ?' : ''}
            ${pays ? 'AND dt.Pays LIKE ?' : ''}
        `;
    
        // Exécution des requêtes de comptage
        const [doctorsCountResult] = await db.query(countDoctors, countParams);
        const [docteursTunisieCountResult] = await db.query(countDocteursTunisie, countParams);
console.log("")    
        // Extraction des totaux
        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;
    
        const total = totalDoctors + totalDocteursTunisie;
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;
    
        // Retour des résultats avec pagination
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    
    } catch (err) {
        console.error('Erreur lors de la récupération des médecins:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
    }
};
const getDoctorsparvillepaysspecialitesavantder = async (req, res) => {
    const speciality_id = req.query.speciality_id; // Nom de la spécialité
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays
    const limit = parseInt(req.query.limit) || 10; // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const countParams = [];
    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    // Requête pour la table `doctors`
    let queryDoctors = `
        SELECT  
            d.name AS name,
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title AS title,
            usr.phone_number,
            addr.ville,
            addr.pays,
            addr.address AS adresse_exacte,
            JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
            'conventionné' AS type
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            experiences a ON d.id = a.doctor_id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
          

    `;

    if (speciality_id) {
        conditionsDoctors.push('s.name LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDoctors.push('addr.ville LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDoctors.push('addr.pays LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }
   
    if (conditionsDoctors.length > 0) {
        queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
    }

    queryDoctors += `
        GROUP BY  
            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,
            usr.phone_number, 
            addr.ville,
            addr.pays, 
            addr.address
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Requête pour la table `docteurs_tunisie`
    let queryDocteursTunisie = `
        SELECT 
            dt.name AS name,
            NULL AS doctor_photo,
            NULL AS enable_online_consultation,
            NULL AS description,
            NULL AS horaires,
            NULL AS cabinet_photo,
            NULL AS created_at,
            NULL AS title,
            dt.Phone AS phone_number,
            dt.Location AS ville,
            dt.Pays AS pays,
           dt.adresse AS adresse_exacte,
            dt.Sector AS specialites ,
            'non-conventionné' AS type
        FROM 
            docteurs_tunisie dt
    `;
  
    if (speciality_id) {
        conditionsDocteursTunisie.push('dt.Sector LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDocteursTunisie.push('dt.Location LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDocteursTunisie.push('dt.Pays LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }

    if (conditionsDocteursTunisie.length > 0) {
        queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
    }

    queryDocteursTunisie += `
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    try {
        // Exécution des requêtes séparées
        const [resultsDoctors] = await db.query(queryDoctors, queryParams);
        const [resultsDocteursTunisie] = await db.query(queryDocteursTunisie, queryParams);
        
        // Combiner les résultats
        let results = [...resultsDoctors, ...resultsDocteursTunisie];

        // Filtrer les résultats : ignorer les médecins nommés "demo" sans adresse
        results = results.filter(result => {
            let doctorName = '';
        
            // Si le champ 'name' est une chaîne JSON, essayer de la parser
            try {
                const nameObj = JSON.parse(result.name); // Parse la chaîne JSON
                doctorName = nameObj.fr || ''; // Récupérer le nom en français
            } catch (err) {
                // Si parsing échoue, doctorName reste une chaîne vide
                console.error('Erreur de parsing du nom du médecin:', err);
            }
        
            // Exclure les médecins dont le nom est "Demo Doctor"
            if (doctorName.toLowerCase() === "demo doctor") {
                return false; // Ne pas afficher ce médecin
            }
            if (!result.ville || !result.pays || result.ville.trim() === "" || result.pays.trim() === "") {
                return false; // Ne pas afficher ce médecin si ville ou pays sont invalides
            }
            return true;
        });
        
       
        // Formatage des spécialités en tableau JSON
        results.forEach(result => {
            if (result.specialities) {
                try {
                    if (typeof result.specialities === 'string') {
                        result.specialities = JSON.parse(result.specialities);
                    }
                } catch (err) {
                    console.error('Erreur de parsing JSON pour les spécialités:', err);
                    result.specialities = [];  // Remplace par un tableau vide en cas d'erreur
                }
            }
        });
        
        // Comptage pour la table `doctors`
        let countDoctors = `
        SELECT COUNT(DISTINCT d.id) AS total
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
        WHERE 1=1
            ${speciality_id ? 'AND s.name LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
        `;
        
        // Comptage pour la table `docteurs_tunisie`
        let countDocteursTunisie = `
        SELECT COUNT(*) AS total
        FROM docteurs_tunisie dt 
        WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.Location LIKE ?' : ''}
            ${pays ? 'AND dt.Pays LIKE ?' : ''}
        `;
    
        // Exécution des requêtes de comptage
        const [doctorsCountResult] = await db.query(countDoctors, countParams);
        const [docteursTunisieCountResult] = await db.query(countDocteursTunisie, countParams);
    
        // Extraction des totaux
        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;
    
        const total = totalDoctors + totalDocteursTunisie;
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;
    
        // Retour des résultats avec pagination
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    
    } catch (err) {
        console.error('Erreur lors de la récupération des médecins:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
id_aleatoire    }
};
const getDoctorsparvillepaysspecialitesnein = async (req, res) => {
    const speciality_id = req.query.speciality_id; // Nom de la spécialité
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays
    const limit = parseInt(req.query.limit) || 10; // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const countParams = [];

    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    // Requête pour la table `doctors`
    let queryDoctors = `
        SELECT  
            d.name AS name,
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title AS title,
            usr.phone_number,
            addr.ville,
            addr.pays,
                    JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,

            'conventionné' AS type
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            experiences a ON d.id = a.doctor_id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
    `;

    if (speciality_id) {
        conditionsDoctors.push('s.name LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDoctors.push('addr.ville LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDoctors.push('addr.pays LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }

    if (conditionsDoctors.length > 0) {
        queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
    }

    queryDoctors += `
        GROUP BY  
            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,
            usr.phone_number, 
            addr.ville,
            addr.pays
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Requête pour la table `docteurs_tunisie`
    let queryDocteursTunisie = `
        SELECT 
            dt.name AS name,
            NULL AS doctor_photo,
            NULL AS enable_online_consultation,
            NULL AS description,
            NULL AS horaires,
            NULL AS cabinet_photo,
            NULL AS created_at,
            NULL AS title,
            dt.Phone AS phone_number,
            dt.adresse AS ville,
            dt.Location AS pays,
            dt.Sector AS specialites ,
            'non-conventionné' AS type
        FROM 
            docteurs_tunisie dt
              
    `;
  
    if (speciality_id) {
        conditionsDocteursTunisie.push('dt.Sector LIKE ?');
        queryParams.push(`%${speciality_id}%`);
        countParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        conditionsDocteursTunisie.push('dt.adresse LIKE ?');
        queryParams.push(`%${ville}%`);
        countParams.push(`%${ville}%`);
    }

    if (pays) {
        conditionsDocteursTunisie.push('dt.Location LIKE ?');
        queryParams.push(`%${pays}%`);
        countParams.push(`%${pays}%`);
    }

    if (conditionsDocteursTunisie.length > 0) {
        queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
    }

    queryDocteursTunisie += `
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Combinaison des deux requêtes avec UNION ALL
    const finalQuery = `
        (
            ${queryDoctors}
        )
        UNION ALL
        (
            ${queryDocteursTunisie}
        )
        ORDER BY RAND()
    `;

    try {
        console.log("Final query with params:", finalQuery, queryParams);
        const [results] = await db.query(finalQuery, queryParams);
        
        // Vérification des résultats
        console.log("Results found:", results);
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun médecin trouvé avec ces critères.' });
        }

        // Formatage des spécialités en tableau JSON
        results.forEach(result => {
            // S'assurer que `specialities` est bien un tableau
            if (result.specialities) {
                try {
                    // Vérifier si la chaîne est déjà un JSON valide
                    if (typeof result.specialities === 'string') {
                        // Si c'est une chaîne, essayer de la parser
                        result.specialities = JSON.parse(result.specialities);
                    }
                } catch (err) {
                    // Si erreur, on logge l'erreur mais on ne bloque pas le programme
                    console.error('Erreur de parsing JSON pour les spécialités:', err);
                    result.specialities = [];  // On remplace par un tableau vide en cas d'erreur
                }
            }
        });
    
        // Comptage pour la table `doctors`
        let countDoctors = `
        SELECT COUNT(DISTINCT d.id) AS total
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
        WHERE 1=1
            ${speciality_id ? 'AND s.name LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
        `;
        
        // Comptage pour la table `docteurs_tunisie`
        let countDocteursTunisie = `
        SELECT COUNT(*) AS total
        FROM docteurs_tunisie dt 
        WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.adresse LIKE ?' : ''}
            ${pays ? 'AND dt.Location LIKE ?' : ''}
        `;
    
        console.log("Count query params:", countParams);
    
        // Exécution des requêtes de comptage
        const [doctorsCountResult] = await db.query(countDoctors, countParams);
        const [docteursTunisieCountResult] = await db.query(countDocteursTunisie, countParams);
    
        // Extraction des totaux
        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;
    
        const total = totalDoctors + totalDocteursTunisie;
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;
    
        // Vérification des résultats du calcul
        console.log("Total doctors:", total);
        console.log("Total pages:", totalPages);
    
        // Retour des résultats avec pagination
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    
    } catch (err) {
        console.error('Erreur lors de la récupération des médecins:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
    }
};

const getDoctorsparvillepaysspecialite6666s = async (req, res) => {
    const speciality_id = req.query.speciality_id;
    const ville = req.query.ville;
    const pays = req.query.pays;
    const limit = 10; 
    const offset = parseInt(req.query.offset) || 0;
    const queryParams = [];
    const countParams = [];

    try {
        // Comptage total
        const countDoctorsQuery = `
            SELECT COUNT(DISTINCT d.id) AS total
            FROM doctors d
            LEFT JOIN addresses addr ON d.user_id = addr.user_id
            WHERE 1=1
            ${speciality_id ? 'AND d.speciality LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
        `;

        const countDocteursTunisieQuery = `
            SELECT COUNT(*) AS total
            FROM docteurs_tunisie dt
            WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.adresse LIKE ?' : ''}
            ${pays ? 'AND dt.Location LIKE ?' : ''}
        `;

        const [doctorsCountResult] = await db.query(countDoctorsQuery, countParams);
        const [docteursTunisieCountResult] = await db.query(countDocteursTunisieQuery, countParams);

        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;
        const total = totalDoctors + totalDocteursTunisie;

        // Pagination
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;

        // Requête principale : sans limite interne dans chaque sous-requête
        const queryDoctors = `
            SELECT d.name, d.doctor_photo, d.enable_online_consultation, addr.ville, addr.pays
            FROM doctors d
            LEFT JOIN addresses addr ON d.user_id = addr.user_id
            WHERE 1=1
        `;

        const queryDocteursTunisie = `
            SELECT dt.name, NULL AS doctor_photo, NULL AS enable_online_consultation, dt.adresse AS ville, dt.Location AS pays
            FROM docteurs_tunisie dt
            WHERE 1=1
        `;

        // Appliquer limit globalement
        const finalQuery = `
            (${queryDoctors})
            UNION ALL
            (${queryDocteursTunisie})
            ORDER BY RAND()
            LIMIT ${limit} OFFSET ${offset}
        `;

        const [results] = await db.query(finalQuery, queryParams);

        return res.json({
            total,
            totalPages,
            currentPage,
            data: results
        });

    } catch (err) {
        console.error('Erreur serveur:', err);
        return res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
};
const getDoctorsparvillepaysspecialites111 = async (req, res) => {
    const speciality_id = req.query.speciality_id;
    const ville = req.query.ville;
    const pays = req.query.pays;
    const limit = parseInt(req.query.limit) || 10; // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const countParams = [];
    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    try {
        // Requête de comptage pour doctors
        const countDoctorsQuery = `
            SELECT COUNT(DISTINCT d.id) AS total
            FROM doctors d
            LEFT JOIN doctor_specialities ds ON d.id = ds.doctor_id
            LEFT JOIN specialities s ON ds.speciality_id = s.id
            LEFT JOIN addresses addr ON d.user_id = addr.user_id
            WHERE 1=1
            ${speciality_id ? 'AND s.name LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
        `;

        if (speciality_id) countParams.push(`%${speciality_id}%`);
        if (ville) countParams.push(`%${ville}%`);
        if (pays) countParams.push(`%${pays}%`);

        // Requête de comptage pour docteurs_tunisie
        const countDocteursTunisieQuery = `
            SELECT COUNT(*) AS total
            FROM docteurs_tunisie dt
            WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.adresse LIKE ?' : ''}
            ${pays ? 'AND dt.Location LIKE ?' : ''}
        `;

        if (speciality_id) countParams.push(`%${speciality_id}%`);
        if (ville) countParams.push(`%${ville}%`);
        if (pays) countParams.push(`%${pays}%`);

        const [doctorsCountResult] = await db.query(countDoctorsQuery, countParams);
        const [docteursTunisieCountResult] = await db.query(countDocteursTunisieQuery, countParams);

        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;
        const total = totalDoctors + totalDocteursTunisie;
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;

        // Requête pour `doctors`
        let queryDoctors = `
            SELECT  
                d.name AS name,
                d.doctor_photo,
                d.enable_online_consultation,
                d.description,
                d.horaires,
                d.cabinet_photo,
                d.created_at,
                a.title AS title,
                usr.phone_number,
                addr.ville,
                addr.pays,

                JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities , 
                   1 AS priority
            FROM 
                doctors d 
            LEFT JOIN 
                doctor_specialities ds ON d.id = ds.doctor_id 
            LEFT JOIN 
                specialities s ON ds.speciality_id = s.id 
            LEFT JOIN 
                experiences a ON d.id = a.doctor_id 
            LEFT JOIN 
                users usr ON d.user_id = usr.id 
            LEFT JOIN 
                addresses addr ON usr.id = addr.user_id
        `;

        if (speciality_id) {
            conditionsDoctors.push('s.name LIKE ?');
            queryParams.push(`%${speciality_id}%`);
        }

        if (ville) {
            conditionsDoctors.push('addr.ville LIKE ?');
            queryParams.push(`%${ville}%`);
        }

        if (pays) {
            conditionsDoctors.push('addr.pays LIKE ?');
            queryParams.push(`%${pays}%`);
        }

        if (conditionsDoctors.length > 0) {
            queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
        }

       queryDoctors += `
            GROUP BY  
                d.name, 
                d.doctor_photo,
                d.enable_online_consultation,
                d.description,
                d.horaires,
                d.cabinet_photo,
                d.created_at,
                a.title,
                usr.phone_number, 
                addr.ville,
                addr.pays
        `;

        // Requête pour `docteurs_tunisie`
        let queryDocteursTunisie = `
            SELECT 
                dt.name AS name,
                NULL AS doctor_photo,
                NULL AS enable_online_consultation,
                NULL AS description,
                NULL AS horaires,
                NULL AS cabinet_photo,
                NULL AS created_at,
                NULL AS title,
                dt.Phone AS phone_number,
                dt.adresse AS ville,
                dt.Location AS pays,
             JSON_ARRAYAGG(JSON_OBJECT('id', dt.Sector, 'name', dt.Sector)) AS specialities , 
                2 AS priority

            FROM 
                docteurs_tunisie dt
        `;

        if (speciality_id) {
            conditionsDocteursTunisie.push('dt.Sector LIKE ?');
            queryParams.push(`%${speciality_id}%`);
        }

        if (ville) {
            conditionsDocteursTunisie.push('dt.adresse LIKE ?');
            queryParams.push(`%${ville}%`);
        }

        if (pays) {
            conditionsDocteursTunisie.push('dt.Location LIKE ?');
            queryParams.push(`%${pays}%`);
        }

        if (conditionsDocteursTunisie.length > 0) {
            queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
        }
  // Add GROUP BY for the docteurs_tunisie query
  queryDocteursTunisie += `
  GROUP BY
      dt.name,
      dt.Phone,
      dt.adresse,
      dt.Location
`;

      // Final query with priority sorting
      const finalQuery = `
      (${queryDoctors})
      UNION ALL
      (${queryDocteursTunisie})
      ORDER BY priority, RAND()
      LIMIT ${limit} OFFSET ${offset}
  `;

        const [results] = await db.query(finalQuery, queryParams);

        return res.json({
            total,
            totalPages,
            currentPage,
            data: results
        });
    } catch (err) {
        console.error('Erreur serveur:', err);
        return res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
};
const getDoctorsparvillepaysspecialitesavf = async (req, res) => {
    const speciality_id = req.query.speciality_id;
    const ville = req.query.ville;
    const pays = req.query.pays;
    const limit = parseInt(req.query.limit) || 10; // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const countParams = [];
    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    try {
        // Requête de comptage pour doctors
        const countDoctorsQuery = `
            SELECT COUNT(DISTINCT d.id) AS total
            FROM doctors d
            LEFT JOIN doctor_specialities ds ON d.id = ds.doctor_id
            LEFT JOIN specialities s ON ds.speciality_id = s.id
            LEFT JOIN addresses addr ON d.user_id = addr.user_id
            WHERE 1=1
            ${speciality_id ? 'AND s.name LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
        `;

        if (speciality_id) countParams.push(`%${speciality_id}%`);
        if (ville) countParams.push(`%${ville}%`);
        if (pays) countParams.push(`%${pays}%`);

        // Requête de comptage pour docteurs_tunisie
        const countDocteursTunisieQuery = `
            SELECT COUNT(*) AS total
            FROM docteurs_tunisie dt
            WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.adresse LIKE ?' : ''}
            ${pays ? 'AND dt.Location LIKE ?' : ''}
        `;

        if (speciality_id) countParams.push(`%${speciality_id}%`);
        if (ville) countParams.push(`%${ville}%`);
        if (pays) countParams.push(`%${pays}%`);

        const [doctorsCountResult] = await db.query(countDoctorsQuery, countParams);
        const [docteursTunisieCountResult] = await db.query(countDocteursTunisieQuery, countParams);

        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;
        const total = totalDoctors + totalDocteursTunisie;
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;

        // Requête pour `doctors`
        let queryDoctors = `
            SELECT  
                d.name AS name,
                d.doctor_photo,
                d.enable_online_consultation,
                d.description,
                d.horaires,
                d.cabinet_photo,
                d.created_at,
                a.title AS title,
                usr.phone_number,
                addr.ville,
                addr.pays,

                JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities , 
                   1 AS priority
            FROM 
                doctors d 
            LEFT JOIN 
                doctor_specialities ds ON d.id = ds.doctor_id 
            LEFT JOIN 
                specialities s ON ds.speciality_id = s.id 
            LEFT JOIN 
                experiences a ON d.id = a.doctor_id 
            LEFT JOIN 
                users usr ON d.user_id = usr.id 
            LEFT JOIN 
                addresses addr ON usr.id = addr.user_id
        `;

        if (speciality_id) {
            conditionsDoctors.push('s.name LIKE ?');
            queryParams.push(`%${speciality_id}%`);
        }

        if (ville) {
            conditionsDoctors.push('addr.ville LIKE ?');
            queryParams.push(`%${ville}%`);
        }

        if (pays) {
            conditionsDoctors.push('addr.pays LIKE ?');
            queryParams.push(`%${pays}%`);
        }

        if (conditionsDoctors.length > 0) {
            queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
        }

        queryDoctors += `
            GROUP BY  
                d.name, 
                d.doctor_photo,
                d.enable_online_consultation,
                d.description,
                d.horaires,
                d.cabinet_photo,
                d.created_at,
                a.title,
                usr.phone_number, 
                addr.ville,
                addr.pays
        `;

        // Requête pour `docteurs_tunisie`
        let queryDocteursTunisie = `
            SELECT 
                dt.name AS name,
                NULL AS doctor_photo,
                NULL AS enable_online_consultation,
                NULL AS description,
                NULL AS horaires,
                NULL AS cabinet_photo,
                NULL AS created_at,
                NULL AS title,
                dt.Phone AS phone_number,
                dt.adresse AS ville,
                dt.Location AS pays,
             JSON_ARRAYAGG(JSON_OBJECT('id', dt.Sector, 'name', dt.Sector)) AS specialities , 
                2 AS priority

            FROM 
                docteurs_tunisie dt
        `;

        if (speciality_id) {
            conditionsDocteursTunisie.push('dt.Sector LIKE ?');
            queryParams.push(`%${speciality_id}%`);
        }

        if (ville) {
            conditionsDocteursTunisie.push('dt.adresse LIKE ?');
            queryParams.push(`%${ville}%`);
        }

        if (pays) {
            conditionsDocteursTunisie.push('dt.Location LIKE ?');
            queryParams.push(`%${pays}%`);
        }

        if (conditionsDocteursTunisie.length > 0) {
            queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
        }
  // Add GROUP BY for the docteurs_tunisie query
  queryDocteursTunisie += `
  GROUP BY
      dt.name,
      dt.Phone,
      dt.adresse,
      dt.Location
`;

      // Final query with priority sorting
      const finalQuery = `
      (${queryDoctors})
      UNION ALL
      (${queryDocteursTunisie})
      ORDER BY priority, RAND()
      LIMIT ${limit} OFFSET ${offset}
  `;

        const [results] = await db.query(finalQuery, queryParams);

        return res.json({
            total,
            totalPages,
            currentPage,
            data: results
        });
    } catch (err) {
        console.error('Erreur serveur:', err);
        return res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
};

const getDoctorsparvillepaysspecialitesoff = async (req, res) => {
    const speciality_id = req.query.speciality_id; // Nom de la spécialité
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays
    const limit = 10; // Nombre fixe de résultats par page
    let offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const countParams = [];

    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    // Calcul initial du total
    const countDoctors = `
        SELECT COUNT(DISTINCT d.id) AS total
        FROM doctors d 
        LEFT JOIN doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN specialities s ON ds.speciality_id = s.id 
        LEFT JOIN users usr ON d.user_id = usr.id 
        LEFT JOIN addresses addr ON usr.id = addr.user_id
        WHERE 1=1
            ${speciality_id ? 'AND s.name LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
    `;
    
    const countDocteursTunisie = `
        SELECT COUNT(*) AS total
        FROM docteurs_tunisie dt 
        WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.adresse LIKE ?' : ''}
            ${pays ? 'AND dt.Location LIKE ?' : ''}
    `;

    countParams.push(...queryParams);

    try {
        // Récupération des totaux
        const [doctorsCountResult] = await db.query(countDoctors, countParams);
        const [docteursTunisieCountResult] = await db.query(countDocteursTunisie, countParams);

        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;
        const total = totalDoctors + totalDocteursTunisie;

        // Calcul de la pagination
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;

        // Validation pour éviter les pages vides
        if (offset >= total && total > 0) {
            offset = (totalPages - 1) * limit; // Ajuster à la dernière page valide
        }

        // Construire les requêtes avec offset corrigé
        const queryDoctors = `
            SELECT 
                d.name AS name, d.doctor_photo, 
                d.enable_online_consultation, d.description, 
                addr.ville, addr.pays
            FROM doctors d
            LEFT JOIN addresses addr ON d.user_id = addr.user_id
            WHERE 1=1
            ${conditionsDoctors.join(' AND ')}
            LIMIT ? OFFSET ?
        `;

        queryParams.push(limit, offset);

        // Union All pour les docteurs
        const finalQuery = `
            (
                ${queryDoctors}
            )
            UNION ALL
            (
                SELECT 
                dt.name, null AS doctor_photo, null AS enable_online_consultation, null AS description, 
                dt.adresse, dt.Location
                FROM docteurs_tunisie dt
                LIMIT ? OFFSET ?
            )
            ORDER BY RAND()
        `;
        
        // Requête des données
        const [results] = await db.query(finalQuery, queryParams);

        return res.json({
            total,
            totalPages,
            currentPage,
            data: results
        });

    } catch (err) {
        console.error('Erreur serveur:', err);
        res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
};

const getDoctorsparvillepaysspecialitesq = async (req, res) => {
    const speciality_id = req.query.speciality_id;
    const ville = req.query.ville;
    const pays = req.query.pays;
    const limit = parseInt(req.query.limit) || 10; // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [];
    const countParams = [];
    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    try {
        // Requête de comptage pour doctors
        const countDoctorsQuery = `
            SELECT COUNT(DISTINCT d.id) AS total
            FROM doctors d
            LEFT JOIN doctor_specialities ds ON d.id = ds.doctor_id
            LEFT JOIN specialities s ON ds.speciality_id = s.id
            LEFT JOIN addresses addr ON d.user_id = addr.user_id
            WHERE 1=1
            ${speciality_id ? 'AND s.name LIKE ?' : ''}
            ${ville ? 'AND addr.ville LIKE ?' : ''}
            ${pays ? 'AND addr.pays LIKE ?' : ''}
        `;

        if (speciality_id) countParams.push(`%${speciality_id}%`);
        if (ville) countParams.push(`%${ville}%`);
        if (pays) countParams.push(`%${pays}%`);

        // Requête de comptage pour docteurs_tunisie
        const countDocteursTunisieQuery = `
            SELECT COUNT(*) AS total
            FROM docteurs_tunisie dt
            WHERE 1=1
            ${speciality_id ? 'AND dt.Sector LIKE ?' : ''}
            ${ville ? 'AND dt.adresse LIKE ?' : ''}
            ${pays ? 'AND dt.Location LIKE ?' : ''}
        `;

        if (speciality_id) countParams.push(`%${speciality_id}%`);
        if (ville) countParams.push(`%${ville}%`);
        if (pays) countParams.push(`%${pays}%`);

        const [doctorsCountResult] = await db.query(countDoctorsQuery, countParams);
        const [docteursTunisieCountResult] = await db.query(countDocteursTunisieQuery, countParams);

        const totalDoctors = doctorsCountResult[0]?.total || 0;
        const totalDocteursTunisie = docteursTunisieCountResult[0]?.total || 0;
        const total = totalDoctors + totalDocteursTunisie;
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;

        // Requête pour `doctors`
        let queryDoctors = `
            SELECT  
                d.name AS name,
                d.doctor_photo,
                d.enable_online_consultation,
                d.description,
                d.horaires,
                d.cabinet_photo,
                d.created_at,
                a.title AS title,
                usr.phone_number,
                d.price,
                d.available ,
                                d.commission,

                JSON_ARRAYAGG(JSON_OBJECT('adresse', addr.ville, 'pays', addr.pays)) AS adresse,
                JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities
            FROM 
                doctors d 
            LEFT JOIN 
                doctor_specialities ds ON d.id = ds.doctor_id 
            LEFT JOIN 
                specialities s ON ds.speciality_id = s.id 
            LEFT JOIN 
                experiences a ON d.id = a.doctor_id 
            LEFT JOIN 
                users usr ON d.user_id = usr.id 
            LEFT JOIN 
                addresses addr ON usr.id = addr.user_id
        `;

        if (speciality_id) {
            conditionsDoctors.push('s.name LIKE ?');
            queryParams.push(`%${speciality_id}%`);
        }

        if (ville) {
            conditionsDoctors.push('addr.ville LIKE ?');
            queryParams.push(`%${ville}%`);
        }

        if (pays) {
            conditionsDoctors.push('addr.pays LIKE ?');
            queryParams.push(`%${pays}%`);
        }

        if (conditionsDoctors.length > 0) {
            queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
        }

        queryDoctors += `
            GROUP BY  
                d.name, 
                d.doctor_photo,
                d.enable_online_consultation,
                d.description,
                d.horaires,
                d.cabinet_photo,
                d.created_at,
                d.price ,
                d.available ,
                d.commission,
                a.title,
                usr.phone_number
        `;

        // Requête pour `docteurs_tunisie`
        let queryDocteursTunisie = `
            SELECT 
                dt.name AS name,
                NULL AS doctor_photo,
                NULL AS enable_online_consultation,
                NULL AS description,
                NULL AS horaires,
                NULL AS cabinet_photo,
                NULL AS created_at,
                NULL AS title,
                dt.Phone AS phone_number,
                dt.adresse AS ville,
                dt.Location AS pays,
                dt.Sector AS specialities,
                NULL AS adresse,  -- Ajout de la colonne "adresse" manquante
                NULL AS specialities  -- Ajout de la colonne "specialities" manquante
            FROM 
                docteurs_tunisie dt
        `;

        if (speciality_id) {
            conditionsDocteursTunisie.push('dt.Sector LIKE ?');
            queryParams.push(`%${speciality_id}%`);
        }

        if (ville) {
            conditionsDocteursTunisie.push('dt.adresse LIKE ?');
            queryParams.push(`%${ville}%`);
        }

        if (pays) {
            conditionsDocteursTunisie.push('dt.Location LIKE ?');
            queryParams.push(`%${pays}%`);
        }

        if (conditionsDocteursTunisie.length > 0) {
            queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
        }

        const finalQuery = `
            (${queryDoctors})
            UNION ALL
            (${queryDocteursTunisie})
            ORDER BY RAND()
            LIMIT ${limit} OFFSET ${offset}
        `;

        const [results] = await db.query(finalQuery, queryParams);

        return res.json({
            total,
            totalPages,
            currentPage,
            data: results
        });
    } catch (err) {
        console.error('Erreur serveur:', err);
        return res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
};








const getDoctorsparvillepaysspecialitesd= async (req, res) => {
    const speciality_id = req.query.speciality_id; // Nom de la spécialité
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays
    const limit = parseInt(req.query.limit) || 10; // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = []; // Paramètres pour la requête principale
    const totalQueryParams = []; // Paramètres pour la requête de comptage

    // Collecte des conditions pour les requêtes
    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    // Requête pour le comptage dans la table `doctors`
    let countDoctors = `
        SELECT COUNT(DISTINCT d.id) AS total
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
        WHERE 1=1
    `;

    if (speciality_id) {
        countDoctors += ` AND s.name LIKE ?`;
        totalQueryParams.push(`%${speciality_id}%`);
        conditionsDoctors.push('s.name LIKE ?');
        queryParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        countDoctors += ` AND addr.ville LIKE ?`;
        totalQueryParams.push(`%${ville}%`);
        conditionsDoctors.push('addr.ville LIKE ?');
        queryParams.push(`%${ville}%`);
    }

    if (pays) {
        countDoctors += ` AND addr.pays LIKE ?`;
        totalQueryParams.push(`%${pays}%`);
        conditionsDoctors.push('addr.pays LIKE ?');
        queryParams.push(`%${pays}%`);
    }

    // Requête pour le comptage dans la table `docteurs_tunisie`
    let countDocteursTunisie = `
        SELECT COUNT(*) AS total
        FROM docteurs_tunisie dt
        WHERE 1=1
    `;

    if (speciality_id) {
        countDocteursTunisie += ` AND dt.Sector LIKE ?`;
        totalQueryParams.push(`%${speciality_id}%`);
        conditionsDocteursTunisie.push('dt.Sector LIKE ?');
        queryParams.push(`%${speciality_id}%`);
    }

    if (ville) {
        countDocteursTunisie += ` AND dt.adresse LIKE ?`;
        totalQueryParams.push(`%${ville}%`);
     conditionsDocteursTunisie.push('dt.adresse LIKE ?');
        queryParams.push(`%${ville}%`);
    }

    if (pays) {
        countDocteursTunisie += ` AND dt.Location LIKE ?`;
        totalQueryParams.push(`%${pays}%`);
        conditionsDocteursTunisie.push('dt.Location LIKE ?');
        queryParams.push(`%${pays}%`);
    }

    // Combinaison des deux requêtes de comptage
    const totalCountQuery = `
        SELECT SUM(total) AS total FROM (
            (${countDoctors})
            UNION ALL
            (${countDocteursTunisie})
        ) AS counts
    `;

    // Requête principale pour la table `doctors`
    let queryDoctors = `
        SELECT  
            d.name AS name,
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title AS title,
            usr.phone_number,
            addr.ville,
            addr.pays,
            JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
            'conventionné' AS type
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            experiences a ON d.id = a.doctor_id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
    `;

    if (conditionsDoctors.length > 0) {
        queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
    }

    queryDoctors += `
        GROUP BY  
            d.name, 
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title,
            usr.phone_number, 
            addr.ville,
            addr.pays
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Requête principale pour la table `docteurs_tunisie`
    let queryDocteursTunisie = `
        SELECT 
            dt.name AS name,
            NULL AS doctor_photo,
            NULL AS enable_online_consultation,
            NULL AS description,
            NULL AS horaires,
            NULL AS cabinet_photo,
            NULL AS created_at,
            NULL AS title,
            dt.Phone AS phone_number,
            dt.adresse AS ville,
            dt.Location AS pays,
            dt.Sector AS specialities,
            'non-conventionné' AS type
        FROM 
            docteurs_tunisie dt
    `;

    if (conditionsDocteursTunisie.length > 0) {
        queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
    }

    queryDocteursTunisie += `
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Combinaison des requêtes principales
    const finalQuery = `
        (${queryDoctors})
        UNION ALL
        (${queryDocteursTunisie})
        ORDER BY RAND()
    `;

    try {
        // Exécution de la requête de comptage
        const [[{ total }]] = await db.query(totalCountQuery, totalQueryParams);

        // Gestion de la pagination
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;

        // Exécution de la requête principale
        const [results] = await db.query(finalQuery, queryParams);

        // Retour des résultats avec pagination
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    } catch (err) {
        console.error('Erreur lors de la récupération des médecins:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
    }
};

const getDoctorsparvillepaysspecialitesjdide = async (req, res) => {
    // Récupération des paramètres de la requête
    const speciality_id = req.query.speciality_id; // Nom de la spécialité
    const ville = req.query.ville; // Ville
    const pays = req.query.pays; // Pays
    const limit = parseInt(req.query.limit) || 10; // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats

    // Vérifications des entrées pour éviter des erreurs
    if (limit < 1 || offset < 0) {
        return res.status(400).json({ error: "Les paramètres 'limit' ou 'offset' sont invalides." });
    }

    // Initialisation des tableaux pour les paramètres et les conditions
    const queryParams = [];
    const totalQueryParams = [];
    const conditionsDoctors = [];
    const conditionsDocteursTunisie = [];

    // Requête de comptage pour les médecins dans `doctors`
    let countDoctors = `
        SELECT COUNT(DISTINCT d.id) AS total
        FROM doctors d
        LEFT JOIN doctor_specialities ds ON d.id = ds.doctor_id
        LEFT JOIN specialities s ON ds.speciality_id = s.id
        LEFT JOIN users usr ON d.user_id = usr.id
        LEFT JOIN addresses addr ON usr.id = addr.user_id
        WHERE 1=1
    `;

    // Ajout des conditions dynamiques pour `doctors`
    if (speciality_id) {
        countDoctors += ` AND s.name LIKE ?`;
        conditionsDoctors.push(`s.name LIKE ?`);
        const filter = `%${speciality_id}%`;
        queryParams.push(filter);
        totalQueryParams.push(filter);
    }
    if (ville) {
        countDoctors += ` AND addr.ville LIKE ?`;
        conditionsDoctors.push(`addr.ville LIKE ?`);
        const filter = `%${ville}%`;
        queryParams.push(filter);
        totalQueryParams.push(filter);
    }
    if (pays) {
        countDoctors += ` AND addr.pays LIKE ?`;
        conditionsDoctors.push(`addr.pays LIKE ?`);
        const filter = `%${pays}%`;
        queryParams.push(filter);
        totalQueryParams.push(filter);
    }

    // Requête de comptage pour les médecins dans `docteurs_tunisie`
    let countDocteursTunisie = `
        SELECT COUNT(*) AS total
        FROM docteurs_tunisie dt
        WHERE 1=1
    `;
    if (speciality_id) {
        countDocteursTunisie += ` AND dt.Sector LIKE ?`;
        conditionsDocteursTunisie.push(`dt.Sector LIKE ?`);
        const filter = `%${speciality_id}%`;
        queryParams.push(filter);
        totalQueryParams.push(filter);
    }
    if (ville) {
        countDocteursTunisie += ` AND dt.adresse LIKE ?`;
        conditionsDocteursTunisie.push(`dt.adresse LIKE ?`);
        const filter = `%${ville}%`;
        queryParams.push(filter);
        totalQueryParams.push(filter);
    }
    if (pays) {
        countDocteursTunisie += ` AND dt.Location LIKE ?`;
        conditionsDocteursTunisie.push(`dt.Location LIKE ?`);
        const filter = `%${pays}%`;
        queryParams.push(filter);
        totalQueryParams.push(filter);
    }

    // Requête totale pour le comptage
    const totalCountQuery = `
        SELECT SUM(total) AS total FROM (
            (${countDoctors})
            UNION ALL
            (${countDocteursTunisie})
        ) AS counts
    `;

    // Requête principale pour `doctors`
    let queryDoctors = `
        SELECT  
            d.name AS name,
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title AS title,
            usr.phone_number,
            addr.ville,
            addr.pays,
            JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
            'conventionné' AS type
        FROM doctors d
        LEFT JOIN doctor_specialities ds ON d.id = ds.doctor_id
        LEFT JOIN specialities s ON ds.speciality_id = s.id
        LEFT JOIN experiences a ON d.id = a.doctor_id
        LEFT JOIN users usr ON d.user_id = usr.id
        LEFT JOIN addresses addr ON usr.id = addr.user_id
    `;
    if (conditionsDoctors.length > 0) {
        queryDoctors += ` WHERE ${conditionsDoctors.join(' AND ')}`;
    }
    queryDoctors += `
        GROUP BY  
            d.name, d.doctor_photo, d.enable_online_consultation, d.description,
            d.horaires, d.cabinet_photo, d.created_at, a.title, usr.phone_number,
            addr.ville, addr.pays
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // Requête principale pour `docteurs_tunisie`
    let queryDocteursTunisie = `
        SELECT 
            dt.name AS name,
            NULL AS doctor_photo,
            NULL AS enable_online_consultation,
            NULL AS description,
            NULL AS horaires,
            NULL AS cabinet_photo,
            NULL AS created_at,
            NULL AS title,
            dt.Phone AS phone_number,
            dt.adresse AS ville,
            dt.Location AS pays,
            dt.Sector AS specialities,
            'non-conventionné' AS type
        FROM docteurs_tunisie dt
    `;
    if (conditionsDocteursTunisie.length > 0) {
        queryDocteursTunisie += ` WHERE ${conditionsDocteursTunisie.join(' AND ')}`;
    }

    // Requête finale combinée
    const finalQuery = `
        (${queryDoctors})
        UNION ALL
        (${queryDocteursTunisie})
        ORDER BY RAND()
    `;

    try {
        // Exécution de la requête de comptage
        const [[{ total }]] = await db.query(totalCountQuery, totalQueryParams);

        // Calcul de la pagination
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;

        // Exécution de la requête principale
        const [results] = await db.query(finalQuery, queryParams);

        // Envoi des résultats
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    } catch (err) {
        console.error('Erreur lors de la récupération des médecins:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
    }
};

const getDoctorsById = async (req, res) => {
    const doctorId = req.query.doctor_id;

    // Valider doctor_id
    if (!doctorId) {
        return res.status(400).json({ error: 'Le doctor_id doit être un entier valide.' });
    }

    try {
        // Requête pour les jours de disponibilité (sans pause ni durée)
        const daysQuery = `
            SELECT 
                day,
                start_at,
                end_at
            FROM 
                availability_hours
            WHERE 
                doctor_id = ? AND onligne = 0  AND is_available = 1;
        `;
        const [daysResults] = await db.query(daysQuery, [doctorId]);

        // Requête pour les pauses et la durée
        const pausesQuery = `
        SELECT 
            pause_from AS pause_start,
            pause_to AS pause_end,
            session_duration AS duree
        FROM 
            availability_hours
        WHERE 
            doctor_id = ? AND onligne = 0;
    `;
    const [pausesResults] = await db.query(pausesQuery, [doctorId]);

    // Si des pauses sont récupérées, on en sélectionne une seule (par exemple, la première)
    const uniquePause = pausesResults.length > 0 ? {
        pause_start: pausesResults[0].pause_start,
        pause_end: pausesResults[0].pause_end,
     // duree: pausesResults[0].duree
    } : null;
    // Extraire les durées des pauses
    const uniqueDuree = pausesResults.length > 0 ? pausesResults[0].duree : null;
    // Requête pour récupérer les vacances
    const holidaysQuery = `
        SELECT 
            dateDebut AS holiday_from,
            dateFin AS holiday_to,
            type AS holiday_type,
            raison AS holiday_reason
        FROM 
            vacance
        WHERE 
            doctor_id = ?;
    `;
    const [holidaysResults] = await db.query(holidaysQuery, [doctorId]);

    // Requête pour récupérer les indisponibilités
    const unavailableQuery = `
        SELECT 
            start_at AS indisponible_date_debut,
            ends_at AS indisponible_date_end
        FROM 
            appointments
        WHERE 
            doctor_id = ?;
    `;
    const [unavailableResults] = await db.query(unavailableQuery, [doctorId]);

    const urgence = `SELECT 
     jour , heurDebut, heurFin
    FROM 
    doctor_urgency
WHERE 
    doctor_id = ?;

   `;
   const [urgenceResults] = await db.query(urgence, [doctorId]);

    // Formatage des données pour affichage local
    const formattedHolidays = holidaysResults.map(holiday => ({
        ...holiday,
        holiday_from: new Date(holiday.holiday_from).toLocaleString('fr-FR', { timeZone: 'Africa/Tunis' }),
        holiday_to: new Date(holiday.holiday_to).toLocaleString('fr-FR', { timeZone: 'Africa/Tunis' })
    }));

//    const formattedUnavailable = unavailableResults.map(ind => ({
  //      ...ind,
    //    indisponible_date_debut: new Date(ind.indisponible_date_debut).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }) + ' ' + new Date(ind.indisponible_date_debut).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' }),
      //  indisponible_date_end: new Date(ind.indisponible_date_end).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }) + ' ' + new Date(ind.indisponible_date_end).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' })
  //  }));
 const today = new Date();
    const filteredUnavailable = unavailableResults.filter(ind => {
        const startDate = new Date(ind.indisponible_date_debut);
        return startDate >= today;
    });

    const formattedUnavailable = filteredUnavailable.map(ind => ({
        ...ind,
        indisponible_date_debut: new Date(ind.indisponible_date_debut).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }) + ' ' + new Date(ind.indisponible_date_debut).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' }),
        indisponible_date_end: new Date(ind.indisponible_date_end).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }) + ' ' + new Date(ind.indisponible_date_end).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' })
    }));
    const formattedUrgence = urgenceResults.map(inds => ({
        ...inds,
        jour: new Date(inds.jour).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }), // Format jour as date
        heurDebut: new Date('1970-01-01T' + inds.heurDebut ).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' }), // Format heurDebut as time
        heurFin: new Date('1970-01-01T' + inds.heurFin ).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' }) // Format heurFin as time
    }));
   
   
        res.json({
            days: daysResults,
            pauses: uniquePause,
            duree :uniqueDuree,
            holidays: formattedHolidays,
            urgence :formattedUrgence ,
            indisponibles: formattedUnavailable
        });
    } catch (err) {
        console.error(err); // Debugging
        return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
};


const getDoctorsById24 = async (req, res) => {
    const doctorId = req.query.doctor_id;

    // Valider doctor_id
    if (!doctorId) {
        return res.status(400).json({ error: 'Le doctor_id doit être un entier valide.' });
    }

    try {
        // Requête pour les jours de disponibilité
        const daysQuery = `
            SELECT 
                day,
                start_at,
                end_at
            FROM 
                availability_hours
            WHERE 
                doctor_id = ? AND onligne = 0;
        `;
        const [daysResults] = await db.query(daysQuery, [doctorId]);

        const availability = daysResults.reduce((acc, { day, start_at, end_at }) => {
            if (start_at && end_at) {
                acc[day] = { start: start_at, end: end_at };
            } else {
                acc[day] = {};
            }
            return acc;
        }, {});

        // Requête pour les pauses et la durée
        const pausesQuery = `
            SELECT 
                pause_from AS pause_start,
                pause_to AS pause_end,
                session_duration AS duree
            FROM 
                availability_hours
            WHERE 
                doctor_id = ? AND onligne = 0;
        `;
        const [pausesResults] = await db.query(pausesQuery, [doctorId]);

        const uniquePause = pausesResults.length > 0 ? {
            pause_start: pausesResults[0].pause_start,
            pause_end: pausesResults[0].pause_end
        } : null;

        const uniqueDuree = pausesResults.length > 0 ? pausesResults[0].duree : null;

        // Requête pour les vacances
        const holidaysQuery = `
            SELECT 
                dateDebut AS holiday_from,
                dateFin AS holiday_to,
                type AS holiday_type,
                raison AS holiday_reason
            FROM 
                vacance
            WHERE 
                doctor_id = ?;
        `;
        const [holidaysResults] = await db.query(holidaysQuery, [doctorId]);

        // Requête pour les indisponibilités
        const unavailableQuery = `
            SELECT 
                start_at AS indisponible_date_debut,
                ends_at AS indisponible_date_end
            FROM 
                appointments
            WHERE 
                doctor_id = ?;
        `;
        const [unavailableResults] = await db.query(unavailableQuery, [doctorId]);

        // Filtrer les indisponibilités pour exclure celles inférieures à aujourd'hui
        const today = new Date();
        const filteredUnavailable = unavailableResults.filter(ind => {
            const startDate = new Date(ind.indisponible_date_debut);
            return startDate >= today;
        });

        const formattedUnavailable = filteredUnavailable.map(ind => ({
            ...ind,
            indisponible_date_debut: new Date(ind.indisponible_date_debut).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }) + ' ' + new Date(ind.indisponible_date_debut).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' }),
            indisponible_date_end: new Date(ind.indisponible_date_end).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }) + ' ' + new Date(ind.indisponible_date_end).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' })
        }));

        // Requête pour les urgences
        const urgenceQuery = `
            SELECT 
                jour, heurDebut, heurFin
            FROM 
                doctor_urgency
            WHERE 
                doctor_id = ?;
        `;
        const [urgenceResults] = await db.query(urgenceQuery, [doctorId]);

        const formattedUrgence = urgenceResults.map(inds => ({
            ...inds,
            jour: new Date(inds.jour).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }),
            heurDebut: new Date(`1970-01-01T${inds.heurDebut}`).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' }),
            heurFin: new Date(`1970-01-01T${inds.heurFin}`).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' })
        }));

        const formattedHolidays = holidaysResults.map(holiday => ({
            ...holiday,
            holiday_from: new Date(holiday.holiday_from).toLocaleString('fr-FR', { timeZone: 'Africa/Tunis' }),
            holiday_to: new Date(holiday.holiday_to).toLocaleString('fr-FR', { timeZone: 'Africa/Tunis' })
        }));

        res.json({
            days: availability,
            pauses: uniquePause,
            duree: uniqueDuree,
            holidays: formattedHolidays,
            urgence: formattedUrgence,
            indisponibles: formattedUnavailable
        });
    } catch (err) {
        console.error("Erreur lors de la récupération des données :", err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
};

const getDoctorsByIdf = async (req, res) => {
    const doctorId = req.query.doctor_id;

    // Valider doctor_id
    if (!doctorId) {
        return res.status(400).json({ error: 'Le doctor_id doit être un entier valide.' });
    }

    try {
        // Requête pour les jours de disponibilité (sans pause ni durée)
        const daysQuery = `
            SELECT 
                day,
                start_at,
                end_at
            FROM 
                availability_hours
            WHERE 
                doctor_id = ? AND onligne = 0;
        `;
        const [daysResults] = await db.query(daysQuery, [doctorId]);

        // Transforming the data into the desired format
        const availability = daysResults.reduce((acc, { day, start_at, end_at }) => {
            if (start_at && end_at) {
                acc[day] = { start: start_at, end: end_at };
            } else {
                acc[day] = {};  // For days with no working hours (e.g., "dimanche")
            }
            return acc;
        }, {});
        // Requête pour les pauses et la durée
        const pausesQuery = `
        SELECT 
            pause_from AS pause_start,
            pause_to AS pause_end,
            session_duration AS duree
        FROM 
            availability_hours
        WHERE 
            doctor_id = ? AND onligne = 0;
    `;
    const [pausesResults] = await db.query(pausesQuery, [doctorId]);

    // Si des pauses sont récupérées, on en sélectionne une seule (par exemple, la première)
    const uniquePause = pausesResults.length > 0 ? {
        pause_start: pausesResults[0].pause_start,
        pause_end: pausesResults[0].pause_end,
     // duree: pausesResults[0].duree
    } : null;
    // Extraire les durées des pauses
    const uniqueDuree = pausesResults.length > 0 ? pausesResults[0].duree : null;
    // Requête pour récupérer les vacances
    const holidaysQuery = `
        SELECT 
            dateDebut AS holiday_from,
            dateFin AS holiday_to,
            type AS holiday_type,
            raison AS holiday_reason
        FROM 
            vacance
        WHERE 
            doctor_id = ?;
    `;
    const [holidaysResults] = await db.query(holidaysQuery, [doctorId]);

    // Requête pour récupérer les indisponibilités
    const unavailableQuery = `
        SELECT 
            start_at AS indisponible_date_debut,
            ends_at AS indisponible_date_end
        FROM 
            appointments
        WHERE 
            doctor_id = ?;
    `;
    const [unavailableResults] = await db.query(unavailableQuery, [doctorId]);

    const urgence = `
    SELECT 
      jour , heurDebut, heurFin
    FROM 
      doctor_urgency
    WHERE 
      doctor_id = ?;
 `;
 
 const [urgenceResults] = await db.query(urgence, [doctorId]);
 
 const formattedUrgence = urgenceResults.map(inds => ({
     ...inds,
     jour: new Date(inds.jour).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }), // Format jour as date
     heurDebut: new Date('1970-01-01T' + inds.heurDebut ).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' }), // Format heurDebut as time
     heurFin: new Date('1970-01-01T' + inds.heurFin ).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' }) // Format heurFin as time
 }));

    // Formatage des données pour affichage local
    const formattedHolidays = holidaysResults.map(holiday => ({
        ...holiday,
        holiday_from: new Date(holiday.holiday_from).toLocaleString('fr-FR', { timeZone: 'Africa/Tunis' }),
        holiday_to: new Date(holiday.holiday_to).toLocaleString('fr-FR', { timeZone: 'Africa/Tunis' })
    }));

    const formattedUnavailable = unavailableResults.map(ind => ({
        ...ind,
        indisponible_date_debut: new Date(ind.indisponible_date_debut).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }) + ' ' + new Date(ind.indisponible_date_debut).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' }),
        indisponible_date_end: new Date(ind.indisponible_date_end).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }) + ' ' + new Date(ind.indisponible_date_end).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' })
    }));
  
        res.json({
            days: availability,
            pauses: uniquePause,
            duree :uniqueDuree,
            holidays: formattedHolidays,
            urgence :formattedUrgence ,
            indisponibles: formattedUnavailable
        });
    } catch (err) {
        console.error(err); // Debugging
        return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
};

const getDoctorsById4 = async (req, res) => {
    const doctorId = req.query.doctor_id;

    // Valider doctor_id
    if (!doctorId || isNaN(Number(doctorId))) {
        return res.status(400).json({ error: 'Le doctor_id doit être un entier valide.' });
    }

    const query = `
      SELECT 
        ah.day,
        ah.start_at,
        ah.end_at,
        ah.session_duration AS duree,
        ah.pause_from AS pause_start,
        ah.pause_to AS pause_end,
        h.dateDebut AS holiday_from,
        h.dateFin AS holiday_to,
        h.type AS holiday_type,
        h.raison AS holiday_reason,
        ind.start_at AS indisponible_date,
        ind.ends_at AS indisponible_time
      FROM 
        availability_hours AS ah
      LEFT JOIN 
        vacance AS h 
        ON ah.doctor_id = h.doctor_id 
      LEFT JOIN 
        appointments AS ind 
        ON ah.doctor_id = ind.doctor_id 
      WHERE 
            duree: uniqueDuree,
            holidays: formattedHolidays,
        ah.doctor_id = ?
        AND ah.onligne = 0;
    `;

    try {
        const [results] = await db.query(query, [doctorId]);

        const formattedResults = {
            lundi: {},
            mardi: {},
            mercredi: {},
            jeudi: {},
            vendredi: {},
            samedi: {},
            dimanche: {},
            duree: null,
            indisponibles: [],
            holidays: [],
            pause: {},
        };

        // Utiliser un Set pour éviter les doublons dans les vacances
        const holidaysSet = new Set();

        results.forEach((row) => {
            const dayKey = row.day?.toLowerCase();

            // Vérifier si dayKey correspond à un jour valide
            if (dayKey && formattedResults[dayKey]) {
                // Initialiser si nécessaire
                if (!formattedResults[dayKey].start) {
                    formattedResults[dayKey] = {
                        start: row.start_at || null,
                        end: row.end_at || null,
                    };
                }
            }

            // Ajouter la durée
            if (!formattedResults.duree && row.duree) {
                formattedResults.duree = row.duree;
            }

            // Ajouter les pauses
            if (!formattedResults.pause.start && !formattedResults.pause.end && row.pause_start && row.pause_end) {
                formattedResults.pause = {
                    start: row.pause_start || null,
                    end: row.pause_end || null,
                };
            }

            // Ajouter les vacances (éviter les doublons)
   //         if (row.holiday_from && row.holiday_to) {
            //    const holidayKey = `${row.holiday_from}-${row.holiday_to}`;
              //  if (!holidaysSet.has(holidayKey)) {
                //    holidaysSet.add(holidayKey);
 //const holidayStart = new Date(row.holiday_from).toISOString().split('T')[0];
  //                  const holidayEnd = new Date(row.holiday_to).toISOString().split('T')[0];
//if (holidayStart && holidayEnd) {
       // const holidayKey = `${holidayStart}-${holidayEnd}-${row.holiday_type}-${row.holiday_reason}`;
     //   if (!holidaysSet.has(holidayKey)) {
   //         holidaysSet.add(holidayKey);
    //        formattedResults.holidays.push({
  //              start: holidayStart,
//                ends: holidayEnd,                   
 //formattedResults.holidays.push({
      //                  start: row.holidayStart,
    //                    ends: row.holidayEnd,
                        //type: row.holiday_type || null,
  //          });
//}
  //  }
//}
            // Ajouter les indisponibilités
            if (row.indisponible_date && row.indisponible_time) {
  const startDate = new Date(row.indisponible_date).toISOString();
                    const endDate = new Date(row.indisponible_time).toISOString();
                    const indisponibleRange = `${startDate}:${endDate}`;

//                const indisponibleRange}:${row.indisponible_time}`;
                if (!formattedResults.indisponibles.includes(indisponibleRange)) {
                    formattedResults.indisponibles.push(indisponibleRange);
                }
            }
        });

        res.json(formattedResults);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de la récupération des disponibilités.' });
    }
};

const getDoctorsById6 = async (req, res) => {
    const doctorId = req.query.doctor_id;

    // Valider doctor_id
    if (!doctorId || isNaN(Number(doctorId))) {
        return res.status(400).json({ error: 'Le doctor_id doit être un entier valide.' });
    }

    const query = `
      SELECT 
        ah.day,
        ah.start_at,
        ah.end_at,
        ah.session_duration AS duree,
        ah.pause_from AS pause_start,
        ah.pause_to AS pause_end,
        h.dateDebut AS holiday_from,
        h.dateFin AS holiday_to,
        h.type AS holiday_type,
        h.raison AS holiday_reason,
        ind.start_at AS indisponible_date,
        ind.ends_at AS indisponible_time
      FROM 
        availability_hours AS ah
      LEFT JOIN 
        vacance AS h 
        ON ah.doctor_id = h.doctor_id 
      LEFT JOIN 
        appointments AS ind 
        ON ah.doctor_id = ind.doctor_id 
      WHERE 
        ah.doctor_id = ?
        AND ah.onligne = 0;
    `;

    try {
        const [results] = await db.query(query, [doctorId]);

        const formattedResults = {
            lundi: {},
            mardi: {},
            mercredi: {},
            jeudi: {},
            vendredi: {},
            samedi: {},
            dimanche: {},
            duree: null,
            indisponibles: [],
            holidays: [],
            pause: {},
        };

        // Utiliser un Set pour éviter les doublons dans les vacances
        const holidaysSet = new Set();

        results.forEach((row) => {
            const dayKey = row.day;

            // Ajouter les horaires
            if (dayKey && !formattedResults[dayKey].start) {
                formattedResults[dayKey] = {
                    start: row.start_at || null,
                    end: row.end_at || null,
                };
            }

            // Ajouter la durée
            if (!formattedResults.duree && row.duree) {
                formattedResults.duree = row.duree;
            }

            // Ajouter les pauses
            if (!formattedResults.pause.start && !formattedResults.pause.end && row.pause_start && row.pause_end) {
                formattedResults.pause = {
                    start: row.pause_start || null,
                    end: row.pause_end || null,
                };
            }

            // Ajouter les vacances (éviter les doublons)
            if (row.holiday_from && row.holiday_to) {
                const holidayKey = `${row.holiday_from}-${row.holiday_to}-${row.holiday_type}-${row.holiday_reason}`;
                if (!holidaysSet.has(holidayKey)) {
                    holidaysSet.add(holidayKey);
                    formattedResults.holidays.push({
                        start: row.holiday_from,
                        ends: row.holiday_to,
                        type: row.holiday_type || null,
                        reason: row.holiday_reason || null,
                    });
                }
            }

            // Ajouter les indisponibilités
            if (row.indisponible_date && row.indisponible_time) {
                const indisponibleRange = `${row.indisponible_date}:${row.indisponible_time}`;
                if (!formattedResults.indisponibles.includes(indisponibleRange)) {
                    formattedResults.indisponibles.push(indisponibleRange);
                }
            }
        });

        res.json(formattedResults);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de la récupération des disponibilités.' });
    }
};


const getDoctorsById3 = async (req, res) => {
    const doctorId = req.query.doctor_id; // Retrieve the doctor's ID

    // Validate doctor_id
    if (!doctorId || isNaN(Number(doctorId))) {
        return res.status(400).json({ error: 'Le doctor_id doit être un entier valide.' });
    }

    // Prepare the SQL query
    const query = `SELECT ah.day,ah.start_at,ah.end_at,ah.session_duration AS duree ,ah.pause_to , ah.pause_from ,
                          h.dateDebut ,h.dateFin   
                   FROM availability_hours AS  ah 
LEFT JOIN vacance h ON ah.id = h.doctor_id
                   WHERE ah.doctor_id = ? AND onligne = 0;`;

    try {
        // Execute the query
        const [results] = await db.query(query, [doctorId]);

        // Check if any results were found
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucune disponibilité trouvée pour ce médecin.' });
        }

        // Format results into a structured object
        const formattedResults = results.reduce((acc, row) => {
           if (!acc[row.day])  {
acc[row.day]={
                start: row.start_at,
                end: row.end_at,
                duree:row.duree, 
            };
            
        }
 if (!acc[row.day].duree) {
                acc[row.day].duree = row.duree;
            }
// Add holiday information if present
            if (row.datedebut && row.datefin) {
                acc.holidays = acc.holidays || [];
                acc.holidays.push({
                    datedebut: row.datedebut,
                    datefin: row.datefin,
                });
            }
  if (!acc.pauses) {
                acc.pauses = [];
            }  
                if (row.pause_from &&row.pause_to){

const isDuplicatePause = acc.pauses.some(
(pause) => pause.from === row.pause_from && pause.to ===row.pause_to
);
if(!isDuplicatePause){
acc.pauses.push({
from : row.pause_from ,
to :row.pause_to ,
});}
}
            return acc;
        }, {});

        // Return the formatted results
        res.json(formattedResults);
    } catch (err) {
        console.error(err); // For debugging
        return res.status(500).json({ error: 'Erreur lors de la récupération des disponibilités.' });
    }
};
// Get available dates for doctors
const getDoctorsById2 = async (req, res) => {
    const doctorId = req.query.doctor_id; // Retrieve the doctor's ID

    // Check if doctorId is provided
    if (!doctorId) {
        return res.status(400).json({ error: 'Le doctor_id est requis.' });
    }

    // Prepare the SQL query
    const query = `SELECT day, start_at, end_at FROM availability_hours WHERE doctor_id = ? AND onligne = 0;`;

    try {
        // Execute the query
        const [results] = await db.query(query, [doctorId]);

        // Check if any results were found
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucune disponibilité trouvée pour ce médecin.' });
        }

        // Return the results
        res.json(results);
    } catch (err) {
        console.error(err); // For debugging
        return res.status(500).json({ error: 'Erreur lors de la récupération des disponibilités.' });
    }
};

const specialitespardoctor = async (req, res) => {
    const query = `
      SELECT s.id, s.name, s.icon, COUNT(sd.doctor_id) AS doctor_count
      FROM specialities s
      LEFT JOIN doctor_specialities sd ON s.id = sd.speciality_id
      WHERE s.pays = 'Tunisie'
      GROUP BY s.id, s.name, s.icon
      ORDER BY doctor_count DESC;
    `;

    try {
        const [results] = await db.query(query);
        res.json(results);
    } catch (err) {
        console.error(err); // Debugging
        return res.status(500).json({ error: 'Erreur lors de la récupération des spécialités.' });
    }
};

const getadressempas = async (req, res) => {
    const query = `
        SELECT addresses.latitude, addresses.longitude, addresses.description AS adresse_description, 
               CONCAT(doctors.name) AS doctor_name, 
               GROUP_CONCAT(DISTINCT specialities.name SEPARATOR ', ') AS specialty_names 
        FROM addresses
        JOIN users ON addresses.user_id = users.id  
        JOIN doctors ON users.id = doctors.user_id  
        JOIN clinics ON doctors.clinic_id = clinics.id 
        JOIN doctor_specialities ON doctors.id = doctor_specialities.doctor_id 
        JOIN specialities ON doctor_specialities.speciality_id = specialities.id  
        GROUP BY addresses.latitude, addresses.longitude, addresses.description, doctors.name;
    `;

    try {
        const [results] = await db.query(query);
        res.send(results);
    } catch (err) {
        console.error(err); // Pour le débogage
        res.status(500).json({ error: 'Erreur lors de la récupération des adresses pour les cartes.' });
    }
};

//getvilles
const getvilles = async (req, res) => {
    try {
        const [results] = await db.query('SELECT ville FROM addresses');
        res.send(results);
    } catch (err) {
        console.error(err); // Pour le débogage
        res.status(500).json({ error: 'Erreur lors de la récupération des villes.' });
    }
}

const getville = async (req, res) => {
    try {
        const [results] = await db.query('SELECT ville FROM addresses');
        const normalizedResults = results.map(row => ({
            ville: row.ville
                .replace(/\s+/g, '_')    // Remplace les espaces par des underscores
                .normalize('NFD')       // Décompose les caractères accentués
                .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
                .toLowerCase()          // Convertit en minuscules
        }));

        res.json(normalizedResults);
    } catch (err) {
        console.error(err); // Pour le débogage
        res.status(500).json({ error: 'Erreur lors de la récupération des données des villes.' });
    }
};

const getpays = async (req, res) => {
    try {
        const [results] = await db.query('SELECT DISTINCT pays FROM addresses');
        res.send(results);
    } catch (err) {
        console.error(err); // Pour le débogage
        res.status(500).json({ error: 'Erreur lors de la récupération des pays.' });
    }
};


const getmotif = async (req, res) => {
    const doctorId = req.query.doctor_id; // Récupérer l'ID du médecin
    const specialiteId = req.query.specialite_id; // Récupérer l'ID de la spécialité

    // Vérification si doctorId et specialiteId sont fournis
    if (!doctorId || !specialiteId) {
        return res.status(400).json({ error: 'Les paramètres doctor_id et specialite_id sont requis.' });
    }

    // Préparation de la requête SQL
    const query = `SELECT id, nom, price FROM pattern WHERE specialite_id = ? AND doctor_id = ?`;

    try {
        const [results] = await db.query(query, [specialiteId, doctorId]);
        
        // Vérification si des résultats ont été trouvés
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun motif trouvé pour cette spécialité et ce médecin.' });
        }

        // Retourner les résultats
        res.json(results);
    } catch (err) {
        console.error(err); // Pour le débogage
        return res.status(500).json({ error: 'Erreur lors de la récupération des motifs de spécialités.' });
    }
};

    
const gethistoriqu = async (req, res) => {
    const userId = req.query.userId;

    // Vérifier si l'ID de l'utilisateur est fourni
    if (!userId) {
        return res.status(400).json({ error: 'L\'ID de l\'utilisateur est requis.' });
    }

    const query = `
        SELECT 
            a.appointment_at, a.id,
            a.start_at, a.doctor_id,
            a.ends_at, a.clinic,
            d.name AS doctor_name
        FROM 
            appointments a
        JOIN 
            doctors d ON a.doctor_id = d.id
        WHERE 
            a.user_id = ?;
    `;

    try {
        const [results] = await db.query(query, [userId]);
        res.json(results);
    } catch (err) {
        console.error(err); // Pour le débogage
        return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
    }
};

async function getAppointmentsByPatientId(req, res) {
    const patientId = req.params.patientId;  // Get the patient ID from request parameters

    const query = `
SELECT 
    a.appointment_at AS appointment_at,
    a.start_at AS start_date,
    a.ends_at AS end_date, a.id ,
    c.name AS clinic_name,
    c.clinic_photo AS clinic_photo,
    d.name AS doctor_name, d.id AS iddoctor, -- Ici, on assigne le nom du médecin à doctor_name
    d.doctor_photo AS doctor_photo,  -- Corrigé pour utiliser doctor_photo
    s.status AS appointment_status,
    p.amount AS payment_amount,
    m.name AS payment_method
FROM 
    appointments a
LEFT JOIN 
    appointment_statuses s ON a.appointment_status_id = s.id
LEFT JOIN 
    payments p ON a.payment_id = p.id
LEFT JOIN 
    payment_methods m ON p.payment_method_id = m.id
LEFT JOIN 
    doctors d ON a.doctor_id = d.id
LEFT JOIN 
    clinics c ON a.clinic_id = c.id
WHERE 
    a.user_id  = ?;

    `;

    try {
        const [results] = await db.execute(query, [patientId]);
        if (results.length === 0) {
            return res.status(404).json({ error: 'No appointments found for this patient.' });
        }
        res.json(results);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Internal server error.', details: error.message });
    }
}

function insertAppointments(req, res) {
    console.log('Request Body:', req.body); // Affiche le contenu de req.body
    const authHeader = req.headers['authorization'];

    // Vérifier si le header contient le token
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Accès refusé, token manquant' });
    }
    // Récupérer les paramètres depuis le corps de la requête
    const { appointment_at, ends_at, start_at, doctor_id, clinic, doctor, patient, address, motif_id } = req.body;

    // Vérification des paramètres requis
    if (!appointment_at || !ends_at || !start_at || !token || !doctor_id ) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    // Décoder le token pour récupérer user_id
    
    let user_id;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        user_id = decoded.user_id; // Assurez-vous que user_id est dans le token décodé
    } catch (error) {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
    }
    // Préparer la requête SQL
    const query = `
        INSERT INTO appointments (appointment_at, ends_at, start_at, user_id, doctor_id, clinic, doctor, patient, address, motif_id, appointment_status_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;
   
    const values = [appointment_at, ends_at, start_at, user_id, doctor_id, clinic, doctor, patient, address, motif_id];
    console.log(user_id);

     // Supprimer l'heure disponible associée dans la table 'available_hours'
     const deleteAvailableHourQuery = `
     DELETE FROM availability_hours 
     WHERE doctor_id = ? 
     AND start_at = ? 
     AND end_at = ? 
    
 `;

 const availableHourValues = [doctor_id, start_at, ends_at];

 db.query(deleteAvailableHourQuery, availableHourValues, (deleteError, deleteResults) => {
    if (deleteError) {
        return res.status(500).json({ error: `Erreur lors de la suppression des heures disponibles: ${deleteError.message}` });
    }

    // Réponse réussie si tout s'est bien passé
    res.status(201).json({ 
        message: 'Rendez-vous inséré avec succès, et heure disponible supprimée', 
    });

    // Exécuter la requête
    db.query(query, values, (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message }); // Affiche le message d'erreur
        }
        res.status(201).json({ message: 'Rendez-vous inséré avec succès', id: results.insertId });
    });
});
let querys = `SELECT email FROM users WHERE id = ?;`;

    // Exécution de la requête
    db.query(querys, [user_id], (err, resul) => {
        if (err) {
            console.error(err); // Pour le débogage
            return res.status(500).json({ error: 'Erreur lors de la récupération des disponibilités.' });
        }

        // Vérification si des résultats ont été trouvés
        if (resul.length === 0) {
            return res.status(404).json({ message: 'Aucune disponibilité trouvée pour ce médecin.' });
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
    to: resul,
    subject: 'Confirmation de votre Rendez_vous à Wic-Doctor.com',
    html: `
        <html>
        <body>
            <h2 style="color: #4CAF50;">Bienvenue Cher Patient!</h2>
            <p>Votre rendez_vous avec le médecin  ${doctor} à ${start_at}</p>
            <p>est bien confirmé</p>   
            <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
        </body>
        </html>
    `,
};

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

})
}
const axios = require('axios');
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
const insertAppointment= async (req, res) => {
    console.log('Request Body:', req.body); // Affiche le contenu de req.body
    const authHeader = req.headers['authorization'];

    // Vérifier si le header contient le token
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Accès refusé, token manquant' });
    }

    // Récupérer les paramètres depuis le corps de la requête
    const { appointment_at, ends_at, start_at, doctor_id, clinic, doctor, patient, address, motif_id } = req.body;
console.log("start_at: ",start_at)
    // Vérification des paramètres requis
    if (!ends_at || !start_at || !token || !doctor_id || !motif_id ) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }
let user_id;
try {
    // Vérifier que le token existe avant de tenter de le décoder
    if (!token) {
        return res.status(400).json({ error: 'Token manquant.' });
    }

    // Décoder le token en utilisant jwt.verify
    const decoded = jwt.verify(token, SECRET_KEY);

    // Vérifier que le token décodé contient bien user_id
    if (!decoded || !decoded.user_id) {
        return res.status(400).json({ error: 'Token invalide.' });
    }

    user_id = decoded.user_id;
} catch (error) {
    // Gérer les erreurs spécifiques de jwt.verify
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expiré.' });
    } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token invalide.' });
    } else {
        return res.status(500).json({ error: 'Erreur lors de la vérification du token.' });
    }
}

    // Décoder le token pour récupérer user_id
   // let user_id;
   // try {
       // const decoded = jwt.verify(token, SECRET_KEY);
     //   user_id = decoded.user_id; // Assurez-vous que user_id est dans le token décodé
   // } catch (error) {
  //      return res.status(401).json({ error: 'Token invalide ou expiré.' });
//    }

    // Préparer la requête SQL pour insérer le rendez-vous
    const insertQuery = `
        INSERT INTO appointments (appointment_at, ends_at, start_at, user_id, doctor_id, clinic, doctor, patient, address, motif_id, appointment_status_id,online) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1 ,"web")
    `;
    
    const values = [appointment_at, ends_at, start_at, user_id, doctor_id, clinic, doctor, patient, address, motif_id];
console.log("values: ",JSON.stringify(values))
    // Supprimer l'heure disponible associée dans la table 'available_hours'
    const deleteAvailableHourQuery = `
        DELETE FROM availability_hours 
        WHERE doctor_id = ? 
        AND start_at = ? 
        AND end_at = ?
    `;
    
    const availableHourValues = [doctor_id, start_at, ends_at];
console.log("availableHourValues: ",JSON.stringify(availableHourValues))
/*SELECT*/
 // const selectAvailableHourQuery = `
      //  SELECT * FROM availability_hours 
      //  WHERE doctor_id = ? 
    //    AND start_at = ? 
  //      AND end_at = ?
//    `;
    
    //const availableHourValuess = [doctor_id, start_at, ends_at];
console.log("availableHourValues: ",JSON.stringify(availableHourValues))
    try {

 // await db.query(selectAvailableHourQuery, availableHourValues);
try {
   // const [selectResult] = await db.query(selectAvailableHourQuery, availableHourValues);
    console.log("Suppression réussie. Nombre de lignes supprimées :", JSON.stringify(selectResult));
} catch (error) {
    console.error("Erreur lors de la suppression des heures disponibles :", error.message);
}

        // Supprimer les heures disponibles
//        await db.query(deleteAvailableHourQuery, availableHourValues);
try {
    const [deleteResult] = await db.query(deleteAvailableHourQuery, availableHourValues);
    console.log(`Suppression réussie. Nombre de lignes supprimées : ${deleteResult.affectedRows}`);
} catch (error) {
    console.error("Erreur lors de la suppression des heures disponibles :", error.message);
}
        // Insérer le rendez-vous
//       let [insertResult] =await db.query(insertQuery, values);
try {
     [insertResult] = await db.query(insertQuery, values);
    console.log("Insertion réussie:", insertResult);
} catch (error) {
    console.error("Erreur lors de l'insertion:", error);
}
//console.log("insertResult: ",JSON.stringify(insertResult))
        // Logique d'envoi d'e-mail
        const emailQuery = `SELECT email FROM users WHERE id = ?;`;
        const [userEmail] = await db.query(emailQuery, [user_id]);

const 	emaildoc = `SELECT u.email FROM users u  INNER JOIN doctors d ON u.id = d.user_id WHERE d.id = ?;`;
const [docmail] = await db.query(emaildoc,[doctor_id]);

       // const emailpQuery = `SELECT email FROM  WHERE id = ?;`;
       // const [patientmail] = await db.query(emailpQuery, [patient_id]);

        const phoneQuery = `SELECT phone_number FROM users WHERE id = ?;`;
        const [userphone] = await db.query(phoneQuery, [user_id]);

        //const phonepQuery = `SELECT phone_number FROM patients WHERE id = ?;`;
       // const [patientphone] = await db.query(phoneQuery, [patient_id]);
//        if (patientmail.length === 0) {
  //          return res.status(404).json({ message: 'Aucune disponibilité trouvée pour ce médecin.' });
    //       // return patientmail[0].email == userEmail[0] ;
      //  }
        const namedocQuery = `SELECT name FROM doctors WHERE id = ?;`;
        const [docname] = await db.query(namedocQuery, [doctor_id]);
        const nameQuery = `SELECT name FROM users WHERE id = ?;`;
        const [userName] = await db.query(nameQuery, [user_id]);
        if (userEmail.length === 0) {
            return res.status(404).json({ message: 'Aucune mail pour ce user.' });
        }
        const startDate = new Date(start_at);
        const endDate = new Date(ends_at);

       // Fonction pour formater la date
       const formatDate = (date) => {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
        return `le ${date.toLocaleString('fr-FR', options).replace(',', '')}`; // Remplacer la virgule pour obtenir le format désiré
    };
  // Fonction pour formater l'heure
  const formatTime = (date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`; // Formate l'heure et les minutes
};
    const formattedStartAt = formatDate(startDate);
    const formattedStartAt1 = formatTime(endDate);
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            auth: {
                user: 'laajili.khouloud12@gmail.com',
                pass: 'lmvy ldix qtgm gbna', // Utiliser un mot de passe d'application pour plus de sécurité
            },
        });

        const mailOptions = {
            from: 'laajili.khouloud12@gmail.com',
            to: userEmail[0].email,
            subject: 'Confirmation de votre Rendez-vous',
            html: `<html>
            <body>
                <h2 style="color: #4CAF50;">Bienvenue Cher Patient ${userName[0].name}</h2>
                <p>Votre rendez-vous avec le médecin  ${JSON.parse(docname[0].name).fr}  ${formattedStartAt} au  ${formattedStartAt1} est bien confirmé</p>
                <p></p>   
                <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
            </body>
            </html>`, // Personnalisez l'e-mail selon vos besoins
};
console.log(docmail[0]);
console.log(docmail[0].email);
    const mailOptionss = {
            from: 'laajili.khouloud12@gmail.com',
            to: docmail[0].email,
            subject: 'Confirmation de votre Rendez-vous',
            html: `<html>
            <body>
                <h2 style="color: #4CAF50;">Bienvenue Cher Doctor ${JSON.parse(docname[0].name).fr} </h2>
                <p>Votre avez un rendez-vous avec  ${userName[0].name}  ${formattedStartAt} au  ${formattedStartAt1} est bien confirmé</p>
                <p></p>   
                <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
            </body>
            </html>`, // Personnalisez l'e-mail selon vos besoins
};

const message = `Bienvenue Cher Patient(e)${userName[0].name}\n` +
       `Votre rendez-vous avec le médecin  ${JSON.parse(docname[0].name).fr}  ${formattedStartAt} au  ${formattedStartAt1}  est bien confirmé` +
       `Cordialement,\nL'équipe de Wic-Doctor.`;
 if (userEmail[0].email) {
       // await sendConfirmationEmail(`${name} ${lastname}`,userEmail[0].email, generatedPassword, res, userId);
        await transporter.sendMail(mailOptions);

      }
if (docmail[0].email) {
       // await sendConfirmationEmail(`${name} ${lastname}`,userEmail[0].email, generatedPassword, res, userId);
        await transporter.sendMail(mailOptionss);

      }

     const normalizedPhone = userphone[0].phone_number.replace(/[^\d]/g, ''); // Supprime tout caractère non numérique
  
      // Send SMS confirmation (if phone exists)
      if (userphone[0].phone_number) {
     await sendSMScontactinscrit(normalizedPhone, message);
       // await sendSMScontactinscrit(userphone[0].phone_number,message);

      }
        //await transporter.sendMail(mailOptions);

//        await transporter.sendMail(mailOptions);
  //      await sendSMScontactinscrit(userphone[0].phone_number,message);
console.log(userphone[0].phone_number);
        return res.status(201).json({ message: 'Rendez-vous inséré avec succès', id: insertResult.insertId });
    } catch (error) {
        console.error('Erreur lors de l\'insertion du rendez-vous ou de l\'envoi de l\'e-mail:', error);
        return res.status(500).json({ error: 'Erreur lors de l\'insertion du rendez-vous ou de l\'envoi de l\'e-mail.' });
    }
};

const jwt = require('jsonwebtoken');

// Remplacez 'votre_clé_secrète' par votre clé secrète utilisée pour signer les tokens
const SECRET_KYm3foWWfPUPbtMEY = 'votre_clé_secrète';

function decodeToken(token) {
    try {
        // Vérifier et décoder le token
        const decoded = jwt.verify(token, SECRET_KEY);
        return decoded; // Retourne l'objet décodé contenant les informations du token
    } catch (error) {
        console.error('Erreur lors du décodage du token:', error.message);
        return null; // Retourne null en cas d'erreur
    }
}

// Fonction pour insérer un rendez-vous



//app.post('/reset-password', 
// Route pour demander un lien de réinitialisation
const restpassword = (req, res) => {
    const { email } = req.body;
    const token = crypto.randomBytes(20).toString('hex');

    db.query('INSERT INTO password_resets (email, token) VALUES (?, ?)', [email, token], (err) => {
        if (err) return res.status(500).send('Error saving token');

        // Rediriger vers le lien de réinitialisation
        const resetLink = `http://localhost:3000/reset-password/${token}`;
        res.redirect(resetLink);
    });
}


// Route pour demander une réinitialisation de mot de passe app.post('/forgot-password'
const forgetpass = (req, res) => {
    const { email } = req.body;
    const response = forgotPassword(email);

    if (!response.startsWith("Invalid")) {
        const resetLink = `http://localhost:3000/reset-password?token=${response}`;
        return res.status(200).send(resetLink);
    }
    
    res.status(400).send(response); // Retourne "Invalid email id." si l'email est invalide
}

// Fonction de réinitialisation du mot de passe
function forgotPassword(email) {
    const user = findUserByEmail(email); // Simulez la recherche dans votre base de données

    if (!user) {
        return "Invalid email id.";
    }

    user.token = `${uuidv4()}${uuidv4()}`;
    //user.tokenCreationDate = moment().toISOString();
   user.tokenCreationDate = moment().format('YYYY-MM-DD HH:mm:ss');

    // Ici, vous devriez mettre à jour l'utilisateur dans votre base de données
    updateUser(email ,user.token ,user.tokenCreationDate); // Simulez la mise à jour

    return user.token;
}

// Route pour réinitialiser le mot de passe app.put('/reset-password',
 const resetpass = (req, res) => {
    const { token, passwordpatient } = req.body;
    const response = resetPassword(token, passwordpatient);
    
    res.status(200).send(response);
}

// Fonction de réinitialisation de mot de passe
function resetPassword(token, password) {
    const user = findUserByToken(forgotPassword.user.token); // Simulez la recherche dans votre base de données

    if (!user) {
        return "Invalid token.";
    }

    if (isTokenExpired(user.tokenCreationDate)) {
        return "Token expired.";
    }

    user.passwordpatient = passwordpatient; // Mettez à jour le mot de passe
    user.token = token;
    user.tokenCreationDate = tokenCreationDate;

    // Mettez à jour l'utilisateur dans votre base de données
    updateUserpass(user.token,user.password); // Simulez la mise à jour

    return "Your password successfully updated.";
}

// Simulez la recherche d'utilisateur par email
function findUserByEmail(email) {
  
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM `users` WHERE email = ?';
      db.execute(query, [email], (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results);
      });
    });
  }


// Simulez la recherche d'utilisateur par token
function findUserByToken(token) {
  
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM `users` WHERE api_token = ?';
        db.execute(query, [token], (err, results) => {
          if (err) {
            return reject(err);
          }
          resolve(results);
        });
      });
}
class TokenManager {
    // Durée d'expiration du token en millisecondes (ex: 1 heure)
    static EXPIRATION_TIME = 60 * 60 * 1000; // 1 heure

    // Méthode pour générer un token
    generateToken() {
        const token = `${uuidv4()}${uuidv4()}`;
        return token;
    }

    /**
     * Vérifie si le token a expiré ou non.
     *
     * @param {Date} tokenCreationDate - La date de création du token
     * @returns {boolean} - true si le token a expiré, false sinon
     */
    isTokenExpired(tokenCreationDate) {
        const currentTime = new Date().getTime();
        const tokenTime = tokenCreationDate.getTime();
        return (currentTime - tokenTime) > TokenManager.EXPIRATION_TIME;
    }
}
// Fonction pour mettre à jour l'utilisateur dans la base de données
function updateUser(email, token, tokenCreationDate) {
    const query = 'UPDATE users SET api_token = ?, created_at = ? WHERE email = ?';
    db.execute(query, [token, tokenCreationDate, email], (err, results) => {
        if (err) {
            return console.error('Erreur lors de la mise à jour :', err);
        }
        console.log('Utilisateur mis à jour avec succès :', results.affectedRows);
    });
}
function updateUserpass(token,password) {
    const query = 'UPDATE users SET api_token = ? and password = ?';
    db.execute(query, [token,password], (err, results) => {
        if (err) {
            return console.error('Erreur lors de la mise à jour :', err);
        }
        console.log('Utilisateur mis à jour avec succès :', results.affectedRows);
    });
}





// Simuler la rechefrche d'utilisateur par token
function findUserByToken(token) {
    return users.find(user => user.token === token);
}

// Vérifier si le token a expiré
function isTokenExpired(tokenCreationDate) {
    const creationDate = moment(tokenCreationDate);
    return moment().diff(creationDate, 'minutes') > 60; // Exemple : le token expire après 30 minutes
}

// Fonction pour réinitialiser le mot de passe
function resetPassword(token, password) {
    const user = findUserByToken(token);

    if (!user) {
        return { message: "Invalid token.", success: false };
    }

    if (isTokenExpired(user.tokenCreationDate)) {
        return { message: "Token expired.", success: false };
    }

    user.password = password; // Mettre à jour le mot de passe
    user.tokenCreationDate = moment().format('YYYY-MM-DD HH:mm:ss'); // Mise à jour de la date

    return { message: "Your password has been successfully updated.", success: true };
}


// Fonction "mot de passe oublié" app.post('/api/forgot-password'
const forgs = (req, res) => {
    const { email } = req.body;
   
    db.query('SELECT * FROM users WHERE email = ?', [email], (error, results) => {
        if (error) return res.status(500).json({ message: "Database error." });

        if (results.length === 0) {
            return res.status(400).json({ message: "Email not found." });
        }

        const token = uuidv4(); // Générer un nouveau token
        const tokenCreationDate = moment().format('YYYY-MM-DD HH:mm:ss');
        const response = forgotPassword(email);

        // Mettre à jour l'utilisateur avec le token
       db.query('UPDATE users SET api_token = ?, created_at = ? WHERE email = ?', [token, tokenCreationDate, email], (err) => {
            if (err) return res.status(500).json({ message: "Error updating user." });

         //   sendEmail(email, token); // Simuler l'envoi d'email
           // res.status(200).json({ message: "Reset password email sent." });
          // if (!response.startsWith("Invalid")) {
            const resetLink = `http://localhost:3001/api/reset-password?token=${response}`;
          //  return res.status(200).send(resetLink);
        //}
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
            subject: 'Réinitialisation de votre mot de passe',
            html: `<p>Pour réinitialiser votre mot de passe, veuillez cliquer sur le lien suivant :</p><a href="${resetLink}">${resetLink}</a>`,
        };
    
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
        });
    });
}

function resetPassword(token, password) {
        const user = findUserByToken(forgotPassword.user.token); // Simulez la recherche dans votre base de données
    
        if (!user) {
            return "Invalid token.";
        }
    
        if (isTokenExpired(user.tokenCreationDate)) {
            return "Token expired.";
        }
    
        user.password = password; // Mettez à jour le mot de passe
        user.token = token;
        user.tokenCreationDate = tokenCreationDate;
    
        // Mettez à jour l'utilisateur dans votre base de données
        updateUserpass(user.token,user.password); // Simulez la mise à jour
    
        return "Your password successfully updated.";
    }
    const bcrypt = require('bcrypt'); // Importer bcrypt
const { error } = require('console');

// Fonction pour réinitialiser le mot de passe app.post('/api/reset-password',
 const rests = (req, res) => {
  
        const { token, password } = req.query; // Récupérer le token et le mot de passe depuis les paramètres de requête
    
        // Rechercher l'utilisateur par le token
        db.query('SELECT * FROM users WHERE api_token = ?', [token], (error, results) => {
            if (error) return res.status(500).json({ message: "Database error: " + error.message});
    
            if (results.length === 0) {
                return res.status(400).json({ message: "Invalid token."+ error  });
            }
    
            const user = results[0];
            const isExpired = moment().diff(moment(user.tokenCreationDate), 'minutes') > 30; // Token expire après 30 minutes
    
            if (isExpired) {
                return res.status(400).json({ message: "Token expired." + error.message });
            }
            user.tokenCreationDate = moment().format('YYYY-MM-DD HH:mm:ss'); // Mise à jour de la date

            // Hacher le nouveau mot de passe
            const hashedPassword = bcrypt.hashSync(password, 10);
    
            // Mettre à jour le mot de passe et supprimer le token
            db.query('UPDATE users SET password = ?, api_token = ?, updated_at = ? WHERE id = ?', [hashedPassword,token, user.tokenCreationDate,user.id], (err) => {
                if (err) return res.status(500).json({ message: "Error updating password." + error.message  });
    
                res.status(200).json({ message: "Your password has been successfully updated." });
            });
        });
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
                    <a href="http://localhost:3001/api/login" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Connexion</a>
                    <p>Si vous n'avez pas demandé cette inscription, ignorez simplement cet e-mail.</p>
                    <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
                </body>
                </html>
            `,
        };
    
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
    //app.get('/api/doctors', 
    const getplusprochedocs = (req, res) => {
        const userLatitude = parseFloat(req.query.latitude);
        const userLongitude = parseFloat(req.query.longitude);
    
        const query = 'SELECT * FROM addresses'; // Récupérer tous les médecins
    
        db.query(query, (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
            }
    
            // Calculer la distance et ajouter à chaque médecin
            const doctorsWithDistance = results.map(doctor => {
                const distance = haversineDistance(userLatitude, userLongitude, doctor.latitude, doctor.longitude);
                return {
                    ...doctor,
                    distance: distance // Ajouter la distance
                };
            });
    
            // Trier par distance
            doctorsWithDistance.sort((a, b) => a.distance - b.distance);
    
            // Retourner les médecins les plus proches
            res.json(doctorsWithDistance);
        });
    }
    const { promisify } = require('util');

    const getplusprochedoc = async (req, res) => {
        try {
            const userLatitude = parseFloat(req.query.latitude);
            const userLongitude = parseFloat(req.query.longitude);
    
            const query = 'SELECT * FROM addresses'; // Récupérer tous les médecins
    
            // Si db est un client MySQL2, par exemple, utilisez db.promise().query pour supporter async/await
            const [results] = await db.query(query);
    
            // Calculer la distance et ajouter à chaque médecin
            const doctorsWithDistance = results.map(doctor => {
                const distance = haversineDistance(userLatitude, userLongitude, doctor.latitude, doctor.longitude);
                return {
                    ...doctor,
                    distance: distance // Ajouter la distance
                };
            });
    
            // Trier par distance
            doctorsWithDistance.sort((a, b) => a.distance - b.distance);
    
            // Retourner les médecins les plus proches
            res.json(doctorsWithDistance);
        } catch (err) {
            // Retourner le message d'erreur en cas d'échec
            res.status(500).json({ error: 'Erreur lors de la récupération des médecins.', details: err.message });
        }
    }
    
    
    function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Rayon de la Terre en kilomètres
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance en kilomètres
    }
    
// Middleware pour vérifier le token JWT
function verifyToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).send({ message: 'Token requis' });

    jwt.verify(token, 'your_secret_key', (err, decoded) => {
        if (err) return res.status(500).send({ message: 'Token invalide' });
        req.userId = decoded.id; // L'ID de l'utilisateur extrait du token
      
    });
}
const updateAppointments = (req, res) => {
    const { start_at, end_at ,patern_id} = req.body;

    // Vérification des champs requis
    if (!start_at || !end_at || !patern_id) {
        return res.status(400).send({ message: 'Les champs start_at, end_at, new_start_at et new_end_at sont requis' });
    }
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expiré.' });
            }
            return res.status(401).json({ message: 'Token invalide.' });
        }
    
        // Continue the request with the decoded token
        req.user = decoded;
    });

    if (!token) {
        return res.status(401).json({ message: 'Accès refusé, token manquant' });
    }
    let user_id;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        user_id = decoded.user_id;
      
    } catch (error) {
        return res.status(401).json({ error: 'Token invalide ou expiré.' });
    }
    db.query('SELECT * FROM  appointments WHERE user_id = ? ORDER BY start_at DESC LIMIT 1', 
        [user_id], 
        (err, result) => {
            if (err) {
                return res.status(500).send({ message: 'Erreur lors de la récupération du rendez-vous', error: err });
            }

            if (result.length === 0) {
                return res.status(404).send({ message: 'Aucun rendez-vous trouvé pour cet utilisateur' });
            }

            const oldAppointment = result[0]; // Ancien rendez-vous
           // console.log(oldAppointment);
            // Insérer l'historique
            db.query('INSERT INTO availability_hours (start_at, end_at ,doctor_id , patern_id) VALUES (?, ?, ?,?)', 
                [oldAppointment.start_at, oldAppointment.ends_at , oldAppointment.doctor_id ,patern_id], 
                (err, insertResult) => {
                    if (err) {
                        return res.status(500).send({ message: 'Erreur lors de l\'insertion dans history', error: err });
                    }

                    // Mettre à jour les nouvelles valeurs du rendez-vous
                    db.query('UPDATE appointments SET start_at = ?, ends_at = ? WHERE id = ?', 
                        [start_at, end_at, oldAppointment.id], 
                        (err, updateResult) => {
                            if (err) {
                                return res.status(500).send({ message: 'Erreur lors de la mise à jour du rendez-vous', error: err });
                            }

                            return res.status(200).send({ message: 'Rendez-vous mis à jour avec succès', appointment: updateAppointment });
                        });
                });

                db.query('SELECT d.id AS doctor_id, d.name AS doctor_name, u.email AS doctor_email FROM appointments r JOIN doctors d ON r.doctor_id = d.id JOIN users u ON d.user_id = u.id WHERE r.id = ?;', 
                    [oldAppointment.id], 
                    (err, resulta) => {
                        if (err) {
                            return res.status(500).send({ message: 'Erreur lors de la récupération du rendez-vous', error: err });
                        }
            
                        if (result.length === 0) {
                            return res.status(404).send({ message: 'Aucun rendez-vous trouvé pour cet utilisateur' });
                        }
                        const doctorEmail = resulta[0].doctor_email; // Récupérer l'email du docteur
                        const doctorName = resulta[0].doctor_name; 

                        db.query('SELECT * FROM patients WHERE user_id= ?;', 
                            [user_id], 
                            (err, resultas) => {
                                if (err) {
                                    return res.status(500).send({ message: 'Erreur lors de la récupération du rendez-vous', error: err });
                                }
                    
                                if (result.length === 0) {
                                    return res.status(404).send({ message: 'Aucun rendez-vous trouvé pour cet utilisateur' });
                                }
                                const patientName = resultas[0].first_name;
                                const startDate = new Date(start_at); // Convert to JavaScript Date object

                                // Format to display the day in words and time without seconds
                                const formattedStartAt = startDate.toLocaleString('fr-FR', {
                                    weekday: 'long',   // Full name of the day (e.g., "lundi")
                                    hour: '2-digit',   // Two-digit hour (e.g., "14" for 2 PM)
                                    minute: '2-digit', // Two-digit minute
                                });

                                const startDate1 = new Date(oldAppointment.start_at); // Convert to JavaScript Date object

                                // Format to display the day in words and time without seconds
                                const formattedStartAt1 = startDate1.toLocaleString('fr-FR', {
                                    weekday: 'long',   // Full name of the day (e.g., "lundi")
                                    hour: '2-digit',   // Two-digit hour (e.g., "14" for 2 PM)
                                    minute: '2-digit', // Two-digit minute
                                });
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
                    to: doctorEmail,
                    subject: 'Modification De Rendez-vous',
                    html: `
                        <html>
                        <body>
                            <h2>Bienvenue  Cher Doctor ${JSON.parse(doctorName).fr} </h2>
                            <p>Votre patient ${patientName}  a modifier son rendez-vous de  ${formattedStartAt1} à   ${formattedStartAt} </p>
                            
                            <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
                        </body>
                        </html>
                    `,
                };
            
                transporter.sendMail(mailOptions, function(error, info) {
                    if (error) {
                        console.error('Error sending email:', error);
                        return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email.' });
                    } else {
                        console.log('Email sent: ' + info.response);
                        // Répondre avec le message et l'ID de l'utilisateur
                        return res.status(200).json({ message: 'Merci de vous être inscrit ! Veuillez confirmer votre e-mail ! Nous avons envoyé un lien !',   appointment: updateAppointment  });
                        
                    }
                });
        }
    );
                    });
});
        }
        const updateAppointment = async (req, res) => {
            const { start_at, end_at, patern_id } = req.body;
    const appointment_id = req.params.appointment_id;  // Récupération de appointment_id depuis les paramètres d'URL

            
         
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            
            if (!token) {
                return res.status(401).json({ message: 'Accès refusé, token manquant' });
            }
            
            let user_id;
            try {
                const decoded = jwt.verify(token, SECRET_KEY);
                user_id = decoded.user_id;
            } catch (error) {
                return res.status(401).json({ error: 'Token invalide ou expiré.' });
            }
            
            try {
                // Vérifiez si le rendez-vous existe pour cet utilisateur
                const [oldAppointment] = await db.query(
                    'SELECT * FROM appointments WHERE id = ? AND user_id = ?', 
                    [appointment_id, user_id]
                );
                
                if (oldAppointment.length === 0) {
                    return res.status(404).send({ message: 'Rendez-vous non trouvé pour cet utilisateur' });
                }
                
                // Mettre à jour les horaires de disponibilité
                await db.query(
                    'INSERT INTO availability_hours (start_at, end_at, doctor_id, patern_id) VALUES (?, ?, ?, ?)', 
                    [oldAppointment[0].start_at, oldAppointment[0].ends_at, oldAppointment[0].doctor_id, patern_id]
                );
                
                // Mettre à jour le rendez-vous
                await db.query(
                    'UPDATE appointments SET start_at = ?, ends_at = ? WHERE id = ?', 
                    [start_at, end_at, appointment_id]
                );
        
                const updatedAppointment = {
                    ...oldAppointment[0],
                    start_at,
                    end_at,
                    patern_id
                };
                
                // Informations du médecin
                const [doctorInfo] = await db.query(
                    'SELECT d.id AS doctor_id, d.name AS doctor_name, u.email AS doctor_email ,u.phone_number AS doc_number FROM appointments r JOIN doctors d ON r.doctor_id = d.id JOIN users u ON d.user_id = u.id WHERE r.id = ?', 
                    [appointment_id]
                );
        
                if (doctorInfo.length === 0) {
                    return res.status(404).send({ message: 'Informations du médecin introuvables' });
                }
        
                const doctorEmail = doctorInfo[0].doctor_email;
                const doctorName = JSON.parse(doctorInfo[0].doctor_name).fr;
                const doctorphone = doctorInfo[0].phone_number;                // Informations du patient
                const [patientInfo] = await db.query(
                    'SELECT * FROM patients WHERE user_id = ?', 
                    [user_id]
                );
                
                if (patientInfo.length === 0) {
                    return res.status(404).send({ message: 'Informations du patient introuvables' });
                }
        
                const [patientEmail] = await db.query(
                    'SELECT u.email, u.firstname ,u.phone_number FROM appointments rv JOIN users u ON rv.user_id = u.id WHERE rv.user_id = ?;', 
                    [user_id]
                );
                
                const patientName = patientInfo[0].first_name;
                const emailpatient = patientEmail[0].email;   
                const namepatient = patientEmail[0].firstname;
                const phone_number = patientEmail[0].phone_number;
                const formattedStartAt = new Date(start_at).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
                const formattedStartAt1 = new Date(oldAppointment[0].start_at).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
        
                // Envoi de l'email au médecin
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    port: 587,
                    secure: false,
                    auth: {
                        user: 'laajili.khouloud12@gmail.com',
                        pass: 'lmvy ldix qtgm gbna',  // Remplacez par un mot de passe d'application
                    },
                });
        
                const mailOptionsDoctor = {
                    from: 'laajili.khouloud12@gmail.com',
                    to: doctorEmail,
                    subject: 'Modification De Rendez-vous',
                    html: `
                        <html>
                        <body>
                            <h2>Bienvenue Cher Docteur ${doctorName}</h2>
                            <p>Votre patient ${patientName} a modifié son rendez-vous de ${formattedStartAt1} à ${formattedStartAt}</p>
                            <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
                        </body>
                        </html>
                    `,
                };
        
                // Envoi de l'email au patient
                const mailOptionsPatient = {
                    from: 'laajili.khouloud12@gmail.com',
                    to: emailpatient,
                    subject: 'Modification De Rendez-vous',
                    html: `
                        <html>
                        <body>
                            <h2>Bienvenue Cher Patient ${namepatient}</h2>
                            <p>Votre rendez-vous avec le docteur ${doctorName} a été modifié de ${formattedStartAt1} à ${formattedStartAt} avec succès.</p>
                            <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
                        </body>
                        </html>
                    `,
                };
        
                // Envoi des emails
                await transporter.sendMail(mailOptionsDoctor);
                await transporter.sendMail(mailOptionsPatient);
        
                const [resultat] = await db.query(
                    'SELECT rv.*, u.email, u.firstname, s.status AS statut_nom FROM appointments rv JOIN users u ON rv.user_id = u.id JOIN appointment_statuses s ON rv.appointment_status_id = s.id WHERE rv.user_id = ?;', 
                    [user_id]
                );
              // Prepare the confirmation message
      const message = `Bienvenue ${patientName}!\n` +
      `Votre rendez-vous avec le docteur ${doctorName}  a été modifié de ${formattedStartAt1} à ${formattedStartAt} avec succès. ` +
      `Si vous n'avez pas demandé cette inscription, ignorez simplement ce message.\n` +
      `Cordialement,\nL'équipe de Wic-Doctor.`;

      const messagedotor = `Bienvenue Cher Docteur ${doctorName}!\n` +
      `Votre patient ${patientName} a modifié son rendez-vous de ${formattedStartAt1} à ${formattedStartAt} ` +
      `Cordialement,\nL'équipe de Wic-Doctor.`;

// Send confirmation email
//sendConfirmationEmail(doctorName, doctorEmail, password, res, userId);
//sendConfirmationEmail(patientName,emailpatient,)
console.log(patientEmail[0].phone_number);
console.log(doctorphone);
// Send SMS with the same message
await sendSMScontactinscrit(phone_number, message);
await sendSMScontactinscrit(doctorphone,messagedotor);
                return res.status(200).json({ 
                    message: 'Rendez-vous mis à jour avec succès et notification envoyée', 
                    appointment: resultat 
                });
        
            } catch (err) {
                console.error('Erreur lors de la mise à jour du rendez-vous:', err);
                return res.status(500).send({ message: 'Erreur lors de la mise à jour du rendez-vous', error: err });
            }
        };
        
        
const getDoctorByIdavnt = async (req, res) => {
            const doctorId = req.params.id;
        
            if (!doctorId) {
                return res.status(400).json({ message: "L'ID du docteur est requis." });
            }
        
            const query = `
                SELECT  
    d.id AS doctor_id,
    d.name AS name,
    d.doctor_photo,
    d.enable_online_consultation,
    d.description,
    d.horaires,
    d.cabinet_photo,
    d.created_at,
    a.title AS title,
    usr.phone_number,
    addr.ville,
    addr.pays,
    JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities
FROM 
    doctors d 
LEFT JOIN 
    doctor_specialities ds ON d.id = ds.doctor_id 
LEFT JOIN 
    specialities s ON ds.speciality_id = s.id 
LEFT JOIN 
    experiences a ON d.id = a.doctor_id 
LEFT JOIN 
    users usr ON d.user_id = usr.id 
LEFT JOIN 
    addresses addr ON usr.id = addr.user_id
WHERE 
    d.id = ?
GROUP BY 
    d.id, a.title, usr.phone_number, addr.ville, addr.pays;
            `;
        
            try {
                const [results] = await db.query(query, [doctorId]);
        
                if (results.length === 0) {
                    return res.status(404).json({ message: "Docteur non trouvé." });
                }
        
                // Renvoyer les informations du docteur
                res.status(200).json(results[0]);
            } catch (error) {
                console.error("Erreur lors de la récupération des informations du docteur:", error);
                return res.status(500).json({ message: "Erreur du serveur lors de la récupération du docteur." });
            }
        };
const getDoctorById= async (req, res) => {
            const doctorAleatoireId = req.params.id;
        
            if (!doctorAleatoireId) {
                return res.status(400).json({ message: "L'ID aléatoire du docteur est requis." });
            }
        
            const queryDoctors = `
                SELECT  
                    d.id AS doctor_id,
                    d.name AS name,
                    d.doctor_photo,
                    d.enable_online_consultation,
                    d.description,
                    d.horaires,
                    d.cabinet_photo,
                    d.created_at,d.id_aleatoire AS aleatoire ,
                    a.title AS title,
                    usr.phone_number,
                    addr.ville,
                    addr.pays,
                    addr.address AS adresse_exacte,
                    JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
                    'conventionné' AS type
                FROM 
                    doctors d 
                LEFT JOIN 
                    doctor_specialities ds ON d.id = ds.doctor_id 
                LEFT JOIN 
                    specialities s ON ds.speciality_id = s.id 
                LEFT JOIN 
                    experiences a ON d.id = a.doctor_id 
                LEFT JOIN 
                    users usr ON d.user_id = usr.id 
                LEFT JOIN 
                    addresses addr ON usr.id = addr.user_id
                WHERE 
                    d.id_aleatoire = ?
                GROUP BY 
                    d.id, a.title, usr.phone_number, addr.ville, addr.pays, addr.address;
            `;
        
            const queryDocteursTunisie = `
                SELECT 
                    dt.id AS doctor_id,
                    dt.name AS name,
                    NULL AS doctor_photo,
                    NULL AS enable_online_consultation,
                    NULL AS description,
                    NULL AS horaires,
                    NULL AS cabinet_photo,
                    NULL AS created_at,
                    NULL AS title,dt.id_aleatoire AS aleatoire,
                    dt.Phone AS phone_number,
                    dt.ville AS ville,
                    dt.Pays AS pays,
                    dt.adresse AS adresse_exacte,
                    dt.Sector AS specialities,
                    'non-conventionné' AS type
                FROM 
                    docteurs_tunisie dt
                WHERE 
                    dt.id_aleatoire = ?;
            `;
        
            try {
                // Recherche dans les deux tables
                const [resultsDoctors] = await db.query(queryDoctors, [doctorAleatoireId]);
                const [resultsDocteursTunisie] = await db.query(queryDocteursTunisie, [doctorAleatoireId]);
        
                // Fusionner les résultats
                const results = [...resultsDoctors, ...resultsDocteursTunisie];
        
                if (results.length === 0) {
                    return res.status(404).json({ message: "Docteur non trouvé." });
                }
        
                // Retourner le premier résultat trouvé
                res.status(200).json(results[0]);
            } catch (error) {
                console.error("Erreur lors de la récupération des informations du docteur:", error);
                return res.status(500).json({ message: "Erreur du serveur lors de la récupération du docteur." });
            }
        };        





const cancelAppointment = async (req, res) => {
            const appointmentId = req.params.id; // ID du rendez-vous à annuler
            const cancellationTime = new Date(); // Heure actuelle pour l'annulation
        
            try {
                // Récupérer le rendez-vous à annuler
                const selectQuery = 'SELECT * FROM appointments WHERE id = ?';
                const [selectResult] = await db.query(selectQuery, [appointmentId]);
        
                if (selectResult.length === 0) {
                    return res.status(404).json({ message: "Rendez-vous non trouvé." });
                }
        
                const appointment = selectResult[0]; // Obtenir le premier rendez-vous
                const doctorId = appointment.doctor_id; // Récupérer l'ID du docteur
                const endAt = appointment.ends_at; // Récupérer la date de fin du rendez-vous
                const patternId = appointment.motif_id; // Récupérer le pattern_id
        
                // Mettre à jour le statut du rendez-vous en 7
                const updateQuery = 'UPDATE appointments SET appointment_status_id = ? WHERE id = ?';
                await db.query(updateQuery, [7, appointmentId]);
        
                // Récupérer les informations du patient
                const [patientEmail] = await db.query(
                    'SELECT u.email, u.firstname,u.phone_number , rv.ends_at, rv.start_at FROM appointments rv JOIN users u ON rv.user_id = u.id WHERE rv.id = ?;', 
                    [appointmentId]
                );
        
                // Insérer les données dans la table available_hours
                const insertQuery = 'INSERT INTO availability_hours (start_at, end_at, patern_id, doctor_id) VALUES (?, ?, ?, ?)';
                await db.query(insertQuery, [patientEmail[0].start_at, patientEmail[0].ends_at, patternId, doctorId]);
        
                // Récupérer les informations du médecin
                const [doctorInfo] = await db.query(
                    'SELECT d.id AS doctor_id, d.name AS doctor_name, u.email AS doctor_email   FROM appointments r JOIN doctors d ON r.doctor_id = d.id JOIN users u ON d.user_id = u.id WHERE r.id = ?', 
                    [appointmentId]
                );
        
                const doctorEmail = doctorInfo[0].doctor_email;
                const doctorName = JSON.parse(doctorInfo[0].doctor_name).fr;
                const emailpatient = patientEmail[0].email;   
                const namepatient = patientEmail[0].firstname;
                const phonepatient = patientEmail[0].phone_number;
                
                // Formatage des dates
                const formattedStartAt = new Date(patientEmail[0].ends_at).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
                const formattedStartAt1 = new Date(patientEmail[0].start_at).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
                
                console.log(formattedStartAt , formattedStartAt1);
                
                // Créer un transporteur pour l'envoi des emails
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    port: 587,
                    secure: false,
                    auth: {
                        user: 'laajili.khouloud12@gmail.com',
                        pass: 'lmvy ldix qtgm gbna',
                    },
                });
        
                // Options d'email pour le patient
                const mailOptionsPatient = {
                    from: 'laajili.khouloud12@gmail.com',
                    to: emailpatient,
                    subject: 'Annulation de Rendez-vous',
                    html: `
                       <html>
                            <body>
                                <h2>Bienvenue Cher Patient ${namepatient}</h2>
                                <p>Votre rendez-vous avec le docteur ${doctorName} de ${formattedStartAt1} à ${formattedStartAt}  a été annulé  .</p>
                                <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
                            </body>
                        </html>
                    `,
                };
        
                // Envoi de l'email au patient
                await transporter.sendMail(mailOptionsPatient);
                
                // Options d'email pour le docteur
                const mailOptionsDoctor = {
                    from: 'laajili.khouloud12@gmail.com',
                    to: doctorEmail,
                    subject: 'Annulation de Rendez-vous',
                    html: `
                        <html>
                            <body>
                                <h2>Bienvenue Cher Docteur ${doctorName}</h2>
                                <p>Votre rendez-vous avec le patient ${namepatient} de ${formattedStartAt1} à ${formattedStartAt} a été annulé.</p>
                                <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
                            </body>
                        </html>
                    `,
                };
                const message = `Bienvenue Cher Patient ${namepatient}
                                Votre rendez-vous avec le docteur ${doctorName} de ${formattedStartAt1} à ${formattedStartAt}  a été annulé 
                                Cordialement,L'équipe de Wic-Doctor.`;
                // Envoi de l'email au docteur
                const messagedoc = `Bienvenue Cher Patient ${namepatient}
                Votre rendez-vous avec le docteur ${doctorName} de ${formattedStartAt1} à ${formattedStartAt}  a été annulé 
                Cordialement,L'équipe de Wic-Doctor.`;
                await transporter.sendMail(mailOptionsDoctor);
                console.log(phonepatient);
        await sendSMScontactinscrit(phonepatient,message);
                // Répondre avec succès
                return res.status(200).json({ message: "Rendez-vous annulé avec succès." });
            } catch (error) {
                console.error("Erreur lors de l'annulation du rendez-vous:", error);
                return res.status(500).json({ message: "Erreur du serveur lors de l'annulation du rendez-vous." });
            }
        };
     

// Fonction pour récupérer les rendez-vous dans les 15 prochaines minutes
const getUpcomingAppointments = async () => {
    try {
      const [appointments] = await db.query(
        `SELECT a.*, u.phone_number FROM appointments a LEFT JOIN users u ON a.user_id = u.id WHERE a.start_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 15 MINUTE);`
      );
      return appointments;
    } catch (err) {
      console.error("Erreur lors de la récupération des rendez-vous", err);
      throw new Error('Failed to retrieve upcoming appointments');
    }
  };
  
  // Fonction principale pour envoyer des SMS avant les rendez-vous
  const sendSMSBeforeAppointment = async () => {
    const appointments = await getUpcomingAppointments();
  
    for (const appointment of appointments) {
      const appointmentStartTime = new Date(appointment.start_at);
      const now = new Date();
  
      // Calculer la différence en millisecondes (15 minutes avant le rendez-vous)
      const timeDiff = appointmentStartTime - now - 15 * 60 * 1000;
  
      // Si la différence est positive, planifier l'envoi du SMS
      if (timeDiff > 0) {
        setTimeout(async () => {
          const message = `Votre rendez-vous est prévu dans 15 minutes.`;
          try {
            await sendSMSdertapelle(appointment.phone_numbre, message);
            console.log(`SMS envoyé à ${appointment.phone_numbre}`);

          } catch (error) {
            console.error('Erreur lors de l\'envoi du SMS:', error);
          }
        }, timeDiff);
        const numbersSent = [];
        for (const appointment of appointments) {
          if (appointment.phone_numbre) {
            await sendSMSdertapelle(appointment.phone_numbre, 'Rappel : Vous avez un rendez-vous bientôt');
            numbersSent.push(appointment.phone_numbre);
          }
        }
      
        return numbersSent;  // Re
      }
    }
  }

  const sendSMSdertapelle = async (phone, message) => {
    const api_key = 'INS9057194100'; // Replace with your actual API key
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
  }
  // Fonction pour récupérer tous les cardiologues
  const getAllAnnuairess = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;  // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats

    console.log(`Limit: ${limit}, Offset: ${offset}`); // Vérifiez que les paramètres sont corrects

  //  try {
        // Première requête (doctors)
     //   const query1 = `
     //       SELECT 
      //          d.name AS name,
       //         JSON_ARRAYAGG(JSON_OBJECT('name', s.name)) AS specialities,
       //         usr.phone_number AS phone_number,
//addr.ville AS ville,
     //           addr.pays AS pays
     //       FROM 
      //          doctors d
        //    LEFT JOIN 
        //        doctor_specialities ds ON d.id = ds.doctor_id
         //   LEFT JOIN 
                //specialities s ON ds.speciality_id = s.id
            //LEFT JOIN 
             //   experiences a ON d.id = a.doctor_id
           // LEFT JOIN 
              //  users usr ON d.user_id = usr.id
        //    LEFT JOIN 
               // addresses addr ON usr.id = addr.user_id
            //GROUP BY  
             //   d.id, 
             //   d.name,
             //   usr.phone_number,  
             //   addr.ville,
             //   addr.pays
       // `;
        
       // const [rows1] = await db.execute(query1);
       // console.log("Résultats de doctors:", rows1); // Affiche les résultats de la première requête
        
        // Deuxième requête (docteurs_tunisie) avec LIMIT et OFFSET
        const query2 = `
            SELECT 
                Name AS name,
id_aleatoire                Sector AS specialities,
                Phone AS phone_number,
                adresse AS ville,
                Location AS pays
            FROM 
                docteurs_tunisie
            LIMIT ${limit} OFFSET ${offset}  -- Remplacez les paramètres par des valeurs directes
        `;
        
        console.log(`Exécution de la requête 2 avec LIMIT: ${limit} OFFSET: ${offset}`); // Vérifie les valeurs de LIMIT et OFFSET
        
        const [rows2] = await db.execute(query2);
        console.log("Résultats de docteurs_tunisie:", rows2); // Affiche les résultats de la deuxième requête
        
        // Fusionner les résultats des deux requêtes
        const results = [rows2];
        
        // Envoi des résultats au client
        res.json(results);
        
   
        console.error('Erreur lors de la récupération des cardiologues:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des données' });
    
}

const getAllAnnuairesss = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;  // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats

    console.log(`Limit: ${limit}, Offset: ${offset}`); // Vérifiez que les paramètres sont corrects

    try {
        // Seule la deuxième requête est exécutée
        const query2 = `
            SELECT 
                Name AS name,
                Sector AS specialities,
                Phone AS phone_number,
                adresse AS ville,
                Location AS pays
            FROM 
                docteurs_tunisie
            LIMIT ${limit} OFFSET ${offset}  
        `;
        
        console.log(`Exécution de la requête 2 avec LIMIT: ${limit} OFFSET: ${offset}`); // Vérifie les valeurs de LIMIT et OFFSET
        
        const [rows2] = await db.execute(query2);
        console.log("Résultats de docteurs_tunisie:", rows2); // Affiche les résultats de la deuxième requête
        
        // Transformer les spécialités en chaîne de texte (si elles sont sous forme d'objet JSON)
        rows2.forEach(result => {
            if (Array.isArray(result.specialities)) {
                result.specialities = result.specialities.map(spec => {
                    if (typeof spec === 'object' && spec.fr) {
                        return spec.fr;  // Utiliser la valeur de 'fr'
                    }
                    return spec.name || 'Non spécifié';
                }).join(', ');
            }
        });

        // Envoi des résultats au client
        return res.json(rows2);

    } catch (error) {
        console.error('Erreur lors de la récupération des docteurs_tunisie:', error);

        // Si une erreur se produit après l'envoi de la réponse, éviter une seconde réponse
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des données' });
        }
    }
}

const getAllAnnuaires = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;  // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [limit, offset, limit, offset]; // Paramètres pour les deux requêtes

    try {
        // Requête pour les médecins de la table `doctors`
        const queryDoctors = `
            SELECT 
                d.name AS name,
                d.doctor_photo,
                d.enable_online_consultation,
                d.description,
                d.horaires,
                d.cabinet_photo,
                d.created_at,
                usr.phone_number,
                addr.ville,
                addr.pays,
                JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
                'conventionné' AS type
            FROM 
                doctors d
            LEFT JOIN 
                doctor_specialities ds ON d.id = ds.doctor_id
            LEFT JOIN 
                specialities s ON ds.speciality_id = s.id
            LEFT JOIN 
                users usr ON d.user_id = usr.id
            LEFT JOIN 
                addresses addr ON usr.id = addr.user_id
            GROUP BY 
                d.name, 
                d.doctor_photo, 
                d.enable_online_consultation, 
                d.description, 
                d.horaires, 
                d.cabinet_photo, 
                d.created_at, 
                usr.phone_number, 
                addr.ville, 
                addr.pays
            LIMIT ? OFFSET ?
        `;

        // Requête pour les médecins de la table `docteurs_tunisie`
        const queryDocteursTunisie = `
            SELECT 
                dt.name AS name,
                NULL AS doctor_photo,
                NULL AS enable_online_consultation,
                NULL AS description,
                NULL AS horaires,
                NULL AS cabinet_photo,
                NULL AS created_at,
                dt.Phone AS phone_number,
                dt.adresse AS ville,
                dt.Location AS pays,
                dt.Sector AS specialities,
                'non-conventionné' AS type
            FROM 
                docteurs_tunisie dt
            LIMIT ? OFFSET ?
        `;

        // Combinaison des deux requêtes avec UNION ALL
        const finalQuery = `
            (${queryDoctors})
            UNION ALL
            (${queryDocteursTunisie})
            ORDER BY RAND()
        `;

        // Exécution de la requête combinée
        const [results] = await db.query(finalQuery, queryParams);

        // Vérifier s'il y a des résultats
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun médecin trouvé.' });
        }

        // Transformation des spécialités en texte si nécessaire
        results.forEach(result => {
            if (Array.isArray(result.specialities)) {
                result.specialities = result.specialities.map(spec => {
                    return spec.name || 'Non spécifié';
                }).join(', ');
            }
        });

        // Pagination calculée
        const total = results.length;
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;

        // Retour des résultats au client
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des annuaires:', error);
        return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
};




 
// Configurer Nodemailer pour l'envoi des emails
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'laajili.khouloud12@gmail.com', 
        pass: 'lmvy ldix qtgm gbna', 
    }
  });


//async function envoyerRappelEmail(emailDestinataire, patientName, startAt , appointmentId , doctorName) {
   // try {
      // console.log(`Envoi de l'e-mail à ${emailDestinataire} pour le rendez-vous à ${startAt}`);
      //  const confirmationLink = `https://wic-doctor.com:3004/confirm/${appointmentId}`;
   //     const cancelationLink = `https://wic-doctor.com:3004/cancel/${appointmentId}`;
        
       // const appointmentTime = moment(startAt).tz("Africa/Tunis").locale('fr'); ; // Assurez-vous que l'heure est dans le bon fuseau horaire
      //  const formattedStartAt = appointmentTime.format('dddd D MMMM YYYY [à] HH:mm'); // Formatage de la date et de l'heure

        ///const mailOptions = {
         //   from: 'laajili.khouloud12@gmail.com',
           // to: emailDestinataire,
          //  subject: 'Rappel de votre rendez-vous',
           // html: `
          //  <p>Bonjour ${patientName},</p>
           // <p>Ceci est un rappel pour votre rendez-vous prévu à ${formattedStartAt}. Veuillez confirmer ou annuler votre rendez-vous  avec le Dr ${JSON.parse(doctorName).fr}</p>
         ///   <a href="${confirmationLink}" style="background-color: green; color: white; padding: 10px 20px; text-decoration: none; margin-right: 10px;">Confirmer</a>
      //      <a href="${cancelationLink}" style="background-color: red; color: white; padding: 10px 20px; text-decoration: none;">Annuler</a>
        //    <p>Merci !</p>
          //  <p>Cordialement,<br>L'équipe de Wic-Doctor.</p>
    //     `
      //  };
    //    let info = await transporter.sendMail(mailOptions);
      //  console.log(`Rappel envoyé à ${emailDestinataire} :`, info.messageId);
 //   } catch (error) {
  //      console.error('Erreur lors de l\'envoi du rappel par e-mail:', error);
   // }
//}

//const now = moment().tz("Africa/Tunis"); // Récupérer l'heure locale de la Tunisie
  ///      const futureTime = moment(now).add(15, 'minutes'); // 15 minutes après l'heure actuelle

     //   const formattedNow = now.format('HH:mm');
       // const formattedFutureTime = futureTime.format('HH:mm');

        //console.log(`Comparaison entre ${formattedNow} et ${formattedFutureTime}`);

        // Requête pour récupérer les rendez-vous avec un `start_at` supérieur à 15 minutes par rapport à maintenant
      //  const [rows] = await db.query(`
        //    SELECT u.email, u.name AS patient_name, a.start_at, a.id AS appointment_id, d.name AS doctorname
          //  FROM appointments a
      //      JOIN users u ON a.user_id = u.id
        //    JOIN doctors d ON a.doctor_id = d.id
          //  WHERE DATE_FORMAT(a.start_at, '%H:%i') > ? 
       //     AND appointment_status_id = 1
     //   `, [formattedNow]);

       // console.log('Rendez-vous trouvés :', rows);

       // if (rows.length === 0) {
         //   console.log('Aucun rendez-vous trouvé dans la période spécifiée.');
      //  } else {
            // Envoi des rappels et mise à jour de l'état de l'e-mail
        //    for (let row of rows) {
                // Convertir `start_at` en moment et ajuster à l'heure de la Tunisie
            //    const appointmentTime = moment(row.start_at).tz("Africa/Tunis");  // Convertir `start_at` en heure locale
          //      const localStartAt = appointmentTime.format('HH:mm');

              //  console.log(`Comparaison: localStartAt = ${localStartAt}, formattedFutureTime = ${formattedFutureTime}`);

                // Vérifier si l'heure du rendez-vous est supérieure à l'heure actuelle + 15 minutes
                //if (localStartAt > formattedFutureTime) {
                  //  await envoyerRappelEmail(row.email, row.patient_name, row.start_at ,row.appointment_id ,row.doctorname);
                    
                    // Mettre à jour la base de données pour marquer l'e-mail comme envoyé
                  //  await db.query(`
                    //    UPDATE appointments 
                      //  SET email_sent = TRUE 
                      //  WHERE id = ?
                   // `, [row.appointment_id]);

                   // console.log(`Rappel envoyé à ${row.email} pour le rendez-vous ${row.start_at}`);
               // }
            //}
        //}
    //} catch (error) {
    //  console.error('Erreur lors de la vérification des rendez-vous:', error);
  // }
//
// Fonction pour vérifier les rendez-vous à venir et envoyer des rappels
const verifierEtEnvoyerRappels= async () => {
    try {
        const now = moment().tz("Africa/Tunis"); // Récupérer l'heure locale de la Tunisie
        const futureTime = moment(now).add(48, 'hours'); // 15 minutes après l'heure actuelle

        const formattedNow = now.format('HH:mm');
        const formattedFutureTime = futureTime.format('HH:mm');

        console.log(`Comparaison entre ${formattedNow} et ${formattedFutureTime}`);

        // Requête pour récupérer les rendez-vous avec un `start_at` supérieur à 15 minutes par rapport à maintenant
        const [rows] = await db.query(`
            SELECT u.email, u.name AS patient_name, a.start_at, a.id AS appointment_id , d.name AS doctorname
            FROM appointments a
            JOIN users u ON a.user_id = u.id
            JOIN doctors d ON a.doctor_id = d.id 
            WHERE DATE_FORMAT(a.start_at, '%H:%i') > ?
AND appointment_status_id = 1
               AND email_sent = 0  
          
        `, [formattedNow]);

        console.log('Rendez-vous trouvés :', rows);

        if (rows.length === 0) {
            console.log('Aucun rendez-vous trouvé dans la période spécifiée.');
        } else {
            // Envoi des rappels et mise à jour de l'état de l'e-mail
            for (let row of rows) {
                // Convertir `start_at` en moment et ajuster à l'heure de la Tunisie
                const appointmentTime = moment(row.start_at).tz("Africa/Tunis").add(1, 'hour'); ;  // Convertir `start_at` en heure locale
                const localStartAt = appointmentTime.format('HH:mm');

                console.log(`Comparaison: localStartAt = ${localStartAt}, formattedFutureTime = ${formattedFutureTime}`);

                // Vérifier si l'heure du rendez-vous est supérieure à l'heure actuelle de 15 minutes
                if (localStartAt > formattedFutureTime) {
                    await envoyerRappelEmail(row.email, JSON.parse(row.patient_name).fr , row.start_at ,row.appointment_id ,row.doctorname);
                    
                    // Mettre à jour la base de données pour marquer l'e-mail comme envoyé
                    await db.query(`
                        UPDATE appointments 
                        SET email_sent = TRUE 
                        WHERE id = ?
                    `, [row.appointment_id]);

                    console.log(`Rappel envoyé à ${row.email} pour le rendez-vous ${row.start_at}`);
                }
            }
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des rendez-vous:', error);
    }
};

// Fonction pour annuler le rendez-vous
const annulerRendezVous = async (req, res) => {
    const appointmentId = req.params.appointmentId;
    
    try {
        // Mettre à jour le statut du rendez-vous à "annulé"
        await db.query(`
            UPDATE appointments
            SET appointment_status_id = 7
            WHERE id = ?
        `, [appointmentId]);
        
        res.send('Votre rendez-vous a été annulé.');
    } catch (error) {
        console.error('Erreur lors de l\'annulation du rendez-vous:', error);
        res.status(500).send('Erreur lors de l\'annulation du rendez-vous.');
    }
};

// Fonction pour confirmer le rendez-vous
const confirmerRendezVous = async (req, res) => {
    const appointmentId = req.params.appointmentId;

    try {
        // Vérification si le rendez-vous existe avant de le confirmer
        const [appointment] = await db.query('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
        if (appointment.length === 0) {
            return res.status(404).send('Rendez-vous non trouvé.');
        }

        // Mettre à jour le statut du rendez-vous à "confirmé"
        await db.query(`
           UPDATE appointments
            SET appointment_status_id = 4
            WHERE id = ?
        `, [appointmentId]);
        
        res.send('Votre rendez-vous a été confirmé avec succès.');
    } catch (error) {
        console.error('Erreur lors de la confirmation du rendez-vous:', error);
        res.status(500).send('Erreur lors de la confirmation du rendez-vous.');
    }
};

const verifierEtEnvoyerSmsRappels = async () => {
    try {
        const now = moment().tz("Africa/Tunis");
        const futureTime = moment(now).add(15, 'minutes');

        console.log(`Heure actuelle: ${now.format('YYYY-MM-DD HH:mm')}`);
        console.log(`Fenêtre de rappel jusqu'à: ${futureTime.format('YYYY-MM-DD HH:mm')}`);

        const [rows] = await db.query(`
            SELECT u.email, u.phone_number, u.name AS patient_name, a.start_at, a.id AS appointment_id, d.name AS doctorname
            FROM appointments a
            JOIN users u ON a.user_id = u.id
            JOIN doctors d ON a.doctor_id = d.id 
            WHERE a.start_at BETWEEN ? AND ? 
            AND a.email_sent = FALSE
        `, [now.format('YYYY-MM-DD HH:mm:ss'), futureTime.format('YYYY-MM-DD HH:mm:ss')]);

        console.log('Rendez-vous trouvés :', rows);

        if (rows.length === 0) {
            console.log('Aucun rendez-vous trouvé dans les 48 heures.');
        } else {
            for (let row of rows) {
                // Envoi de l'email
              //  await envoyerRappelEmail(row.email, row.patient_name, row.start_at, row.appointment_id, row.doctorname);
              const api_key = 'INS9057194100'
              const from = '33743134488'; // Replace with your sender ID
             
                // Envoi du SMS
                const smsMessage = `Bonjour ${row.patient_name}, votre rendez-vous avec le Dr. ${row.doctorname} est prévu le ${moment(row.start_at).format('DD/MM/YYYY à HH:mm')}. Merci !`;
                await sendSMScontactinscrit(row.phone_number, smsMessage);
                

                // Mettre à jour la base de données pour marquer l'email/SMS comme envoyé
                await db.query(`
                    UPDATE appointments 
                    SET email_sent = TRUE 
                    WHERE id = ?
                `, [row.appointment_id]);

                console.log(`Rappel envoyé à ${row.email} et SMS envoyé à ${row.phone_number} pour le rendez-vous ${row.start_at}`);
            }
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des rendez-vous:', error);
    }
};


// Envoi d'un email avec un fichier PDF stocké en base de données
const sendEmail = async (req, res) => {
    const { recipient, subject, message, pdfId } = req.body; // pdfId est l'ID du fichier PDF dans la base de données
  
    try {
      // Récupérer le fichier PDF depuis la base de données
      const [rows] = await db.query('SELECT  prescription_pdf FROM  prescriptions WHERE id = ?', [pdfId]);
  
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Fichier PDF non trouvé.' });
      }
  
      const { prescription_pdf } = rows[0]; // Nom et contenu binaire du fichier PDF
  
      // Préparer les options de l'e-mail
      const mailOptions = {
        from: 'laajili.khouloud12@gmail.com',
        to: recipient,
        subject: subject,
        text: message, // Version texte brut
        attachments: [
          {
           // Nom du fichier
            content: Buffer.from(prescription_pdf), // Contenu du fichier converti en Buffer
            contentType: 'application/pdf',
          },
        ],
      };
  
      // Envoyer l'e-mail
      await transporter.sendMail(mailOptions);
  
      // Répondre au client
      res.status(200).json({ success: true, message: 'E-mail envoyé avec la pièce jointe PDF !' });
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'e-mail :', error);
      res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de l\'e-mail.' });
    }
  };
const getblogs = async (req, res) => {
    const query = 'SELECT * FROM blogs';
    try {
        const [results] = await db.query(query); // Utilisation de la syntaxe Promise pour récupérer les résultats

        if (results.length === 0) {
            return res.status(404).json({ message: "Aucun blog trouvé." });
        }

        res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error("Erreur lors de la récupération des informations des blogs:", error);
        return res.status(500).json({ message: "Erreur du serveur lors de la récupération des blogs." });
    }
};

const getveterinaires = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;  // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [limit, offset]; // Paramètres pour la requête

    try {
        // Requête pour récupérer le nombre total de vétérinaires
        const totalCountQuery = `
            SELECT COUNT(*) AS totalCount
            FROM veterinaire dt
        `;

        // Exécution de la requête pour obtenir le total
        const [totalCountResult] = await db.query(totalCountQuery);
        const total = totalCountResult[0].totalCount;  // Total des vétérinaires

        // Calcul du nombre total de pages
        const totalPages = Math.ceil(total / limit);

        // Requête pour récupérer les vétérinaires avec la pagination
        const queryDocteursTunisie = `
            SELECT 
                dt.Name AS name,
                dt.Phone AS phone_number,
                dt.adresse AS Adresse_exacte,
                dt.Location AS ville
            FROM 
                veterinaire dt
            LIMIT ? OFFSET ?
        `;

        // Exécution de la requête
        const [results] = await db.query(queryDocteursTunisie, queryParams);

        // Vérifier s'il y a des résultats
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun vétérinaire trouvé.' });
        }

        // Calcul de la page actuelle
        const currentPage = Math.floor(offset / limit) + 1;

        // Retour des résultats au client avec la pagination
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des vétérinaires:', error);
        return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
};
const getinfermiers = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;  // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [limit, offset]; // Paramètres pour la requête

    try {
        // Requête pour récupérer le nombre total de vétérinaires
        const totalCountQuery = `
            SELECT COUNT(*) AS totalCount
            FROM 	infirmier dt
        `;

        // Exécution de la requête pour obtenir le total
        const [totalCountResult] = await db.query(totalCountQuery);
        const total = totalCountResult[0].totalCount;  // Total des vétérinaires

        // Calcul du nombre total de pages
        const totalPages = Math.ceil(total / limit);

        // Requête pour récupérer les vétérinaires avec la pagination
        const queryDocteursTunisie = `
            SELECT 
                dt.Name AS name,
                dt.Phone AS phone_number,
                dt.adresse AS Adresse_exacte,
                dt.Location AS ville
            FROM 
                	infirmier dt
            LIMIT ? OFFSET ?
        `;

        // Exécution de la requête
        const [results] = await db.query(queryDocteursTunisie, queryParams);

        // Vérifier s'il y a des résultats
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun vétérinaire trouvé.' });
        }

        // Calcul de la page actuelle
        const currentPage = Math.floor(offset / limit) + 1;

        // Retour des résultats au client avec la pagination
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des vétérinaires:', error);
        return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
};
const getpharmacies = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;  // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [limit, offset]; // Paramètres pour la requête

    try {
        // Requête pour récupérer le nombre total de vétérinaires
        const totalCountQuery = `
            SELECT COUNT(*) AS totalCount
            FROM 	pharmaciesliste dt
        `;

        // Exécution de la requête pour obtenir le total
        const [totalCountResult] = await db.query(totalCountQuery);
        const total = totalCountResult[0].totalCount;  // Total des vétérinaires

        // Calcul du nombre total de pages
        const totalPages = Math.ceil(total / limit);

        // Requête pour récupérer les vétérinaires avec la pagination
        const queryDocteursTunisie = `
            SELECT 
                dt.Name AS name,
                dt.Phone AS phone_number,
                dt.Address AS Adresse_exacte,
                dt.Governorate AS Governorate ,
                dt.Delegation AS Delegation ,
                dt.Mode AS Mode 

            FROM 
                	pharmaciesliste dt
            LIMIT ? OFFSET ?
        `;

        // Exécution de la requête
        const [results] = await db.query(queryDocteursTunisie, queryParams);

        // Vérifier s'il y a des résultats
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun vétérinaire trouvé.' });
        }

        // Calcul de la page actuelle
        const currentPage = Math.floor(offset / limit) + 1;

        // Retour des résultats au client avec la pagination
        return res.json({
            total,
 totalPages,
            currentPage,
            data: results,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des vétérinaires:', error);
        return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
};

                      
        // Lancer Puppeteer pour générer le PDF à partir du contenu HTML
      // Arguments nécessaires pour éviter l'erreur
const gethopiteaux = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;  // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [limit, offset]; // Paramètres pour la requête

    try {
        // Requête pour récupérer le nombre total de vétérinaires
        const totalCountQuery = `
            SELECT COUNT(*) AS totalCount
            FROM 	hopiteaux dt
        `;

        // Exécution de la requête pour obtenir le total
        const [totalCountResult] = await db.query(totalCountQuery);
        const total = totalCountResult[0].totalCount;  // Total des vétérinaires

        // Calcul du nombre total de pages
        const totalPages = Math.ceil(total / limit);

        // Requête pour récupérer les vétérinaires avec la pagination
        const queryDocteursTunisie = `
            SELECT 
                dt.Name AS name,
                dt.Phone AS phone_number,
                dt.adresse AS Adresse_exacte,
                dt.Location AS ville,
dt.Sector AS Secteur ,
                dt.Pays AS pays 
            FROM 
                	hopiteaux dt
            LIMIT ? OFFSET ?
        `;

        // Exécution de la requête
        const [results] = await db.query(queryDocteursTunisie, queryParams);

        // Vérifier s'il y a des résultats
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun vétérinaire trouvé.' });
        }

        // Calcul de la page actuelle
        const currentPage = Math.floor(offset / limit) + 1;

        // Retour des résultats au client avec la pagination
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des vétérinaires:', error);
        return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
};
//const puppeteer = require('puppeteer');
//const path = require('path');
//const fs = require('fs');

const generatePDFs = async (req, res) => {
    try {
        // Exécution de la requête SQL pour récupérer les données nécessaires
        const [rows] = await db.query(`
            SELECT 
                p.type AS prescription_type, 
                p.date AS prescription_date, 
                p.observation AS prescription_observation, 
                c.dateConsultation AS consultation_date, 
                c.raison AS consultation_reason, 
                c.motif AS consultation_motif, 
                d.name AS doctor_name, 
                d.diplome AS diplome,
                d.matricule_CNAM As matricule_CNAM,
                d.numOrdre AS numOrdre,
                u.first_name AS patient_first_name, 
                u.last_name AS patient_last_name, 
                JSON_ARRAYAGG(JSON_OBJECT('name', s.name)) AS specialities,
                addr.ville AS ville,
                addr.pays AS pays,
                us.phone_number AS doctor_phone_number, 
                addr.address AS adress,
                JSON_ARRAYAGG(JSON_OBJECT('name', m.NOM_COMMERCIAL, 'dosage', pm.dosage, 'nb_de_jours', pm.nb_de_jours ,'horaire',pm.horaire ,'nb_de_fois' ,pm.nb_de_fois)) AS medications,
                COUNT(pm.medicament_CODE_PCT) AS number_of_medications
            FROM 
                prescriptions p
            LEFT JOIN 
                consultations c ON p.consultation_id = c.id
            LEFT JOIN 
                patients u ON c.patient_id = u.id
            LEFT JOIN 
                doctors d ON c.user_id = d.user_id
            LEFT JOIN 
                doctor_specialities ds ON d.id = ds.doctor_id
            LEFT JOIN 
                specialities s ON ds.speciality_id = s.id
            LEFT JOIN 
                addresses addr ON c.user_id = addr.user_id
            LEFT JOIN 
                medicament_prescription pm ON p.id = pm.prescription_id
            LEFT JOIN 
                medicaments m ON pm.medicament_CODE_PCT = m.CODE_PCT
            LEFT JOIN 
                medicament_prescription mp ON pm.medicament_CODE_PCT = mp.id
            LEFT JOIN 
                users us ON d.user_id = us.id
            WHERE 
                c.patient_id = ?
            GROUP BY
                p.type, p.date, p.observation, c.dateConsultation, c.raison, c.motif, d.name, u.first_name, u.last_name, addr.ville, addr.pays, addr.address, d.diplome ,us.phone_number ,  d.matricule_CNAM , d.numOrdre;`, 
            [req.body.record_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Aucune donnée trouvée pour l'ID donné." });
        }

        const data = rows[0];
        const consultationDate = formatDateToFrench(data.consultation_date || ''); // Exemple avec consultation_date
        const patientName = safeJsonParse(data.patient_first_name)?.fr || 'Nom non spécifié';
        const patientLastName = safeJsonParse(data.patient_last_name)?.fr || 'Nom non spécifié';

        // Assurez-vous que vous avez bien accès aux données
        const doctorName = safeJsonParse(data.doctor_name)?.fr || 'Nom non spécifié';
        const specialityNames = Array.isArray(data.specialities) 
            ? data.specialities.map(speciality => {
                return safeJsonParse(speciality.name)?.fr || 'Non spécifiée';
            }).join(', ') 
            : 'Non spécifiée';
        
        const adresseName = safeJsonParse(data.adress)?.fr || 'Non spécifiée';
        const villeName = safeJsonParse(data.ville)?.fr || 'Non spécifiée';
        const paysName = safeJsonParse(data.pays)?.fr || 'Non spécifié';
        console.log("Valeur de data.medications :", data.medications);

        const medications = (data.medications || '[]');

        // Contenu HTML dynamique basé sur les données SQL
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 40px;
                    max-width: 21cm;
                    margin: 0 auto;
                    padding-left: 20px;
                    padding-right: 20px;
                }
                .header-left h1, .header-left p, .header-right p {
                    margin: 0;
                }
                .patient-info {
                    margin-bottom: 40px;
                }
                .medications {
                    margin-top: 20px;
                }
                .instructions {
                    margin-top: 20px;
                    font-style: italic;
                }
               .footer {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 80px;
                    font-size: 1.1em;
                    padding-left: 20px;
                    padding-right: 20px;
                }

                .signature {
                    text-align: center;
                    margin-top: 30px;
                }

                .signature p:first-child {
                    margin-bottom: 10px;
                }

                .signature .line {
                    display: inline-block;
                    width: 150px;
                    border-top: 2px solid #000;
                    margin-top: 10px;
                }

            </style>
        </head>
        <body>
            <header class="header">
                <div class="header-left">
                    <br><br>
                    <h1>Dr. ${doctorName}</h1>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 0; text-align: left;">Médecin ${specialityNames || 'Non spécifiée'}</td>
                            <td style="padding: 0; text-align: right;">${adresseName || 'Non spécifiée'}</td>
                        </tr>
                    </table>
                    <div style="border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 0; text-align: left;">${data.diplome || 'Non spécifiée'} <br>
                                    N° d'order: ${data.numOrdre || 'Non spécifiée'} </td>
                                <td style="padding: 0; text-align: right;"><strong>Tél :</strong> ${data.doctor_phone_number || 'Non spécifiée'}<br>  <br></td>
                            </tr>
                        </table>
                    </div>
                </div>
            </header>
            <div class="header">
                <div style="text-align: center">
                    <p><strong>Matricule CNAM: </strong>${data.matricule_CNAM}</p>
                </div>
                <p style="padding: 0; text-align: right;"><strong>Le </strong>${consultationDate || 'Non spécifiée'}<br>  <br></p>
            </div>
            <div>
                <p><strong>Mr/Mme ${patientName} ${patientLastName}</strong></p>
                <br>
                <h1>${data.prescription_type || 'Non spécifiée'}</h1>
                <br>
                <p>
                    ${medications.map(med => `
                        <p>${med.name} - ${med.dosage}, ${med.nb_de_fois}, ${med.horaire} ${med.nb_de_jours}</p>
                    `).join('')}
                </p>
                <p><strong>Observation :</strong> ${data.prescription_observation || 'Aucune'}</p>
                <p><strong>Total Médicaments: </strong>${data.number_of_medications}</p>
            </div>
            <div class="footer">
                <div class="signature">
                    <p>Signature</p>
                    <div class="line"></div>
                </div>
            </div>
        </body>
        </html>`;

        // Lancer Puppeteer pour générer le PDF à partir du contenu HTML
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Arguments nécessaires pour éviter l'erreur "running as root"
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Définir le répertoire où enregistrer les PDF
        const pdfDir = path.join(__dirname, '../pdfs');
        const pdfPath = path.join(pdfDir, `ordonnance-${Date.now()}.pdf`);

        // Créer le répertoire si nécessaire
        if (!fs.existsSync(pdfDir)) {
            fs.mkdirSync(pdfDir, { recursive: true });
        }

        // Générer le PDF
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
        await browser.close();

        // Répondre avec l'URL du fichier PDF généré
        res.status(200).json({ url: `http://localhost:3001/pdfs/${path.basename(pdfPath)}` });

    } catch (error) {
        console.error('Erreur lors de la génération du PDF :', error);
        res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
};
               
const getlaboratoire = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;  // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [limit, offset]; // Paramètres pour la requête

    try {
        // Requête pour récupérer le nombre total de vétérinaires
        const totalCountQuery = `
        SELECT COUNT(*) AS totalCount
        FROM laboratoireanalysemedicale dt
    `;
    

        // Exécution de la requête pour obtenir le total
        const [totalCountResult] = await db.query(totalCountQuery);
        const total = totalCountResult[0].totalCount;  // Total des vétérinaires

        // Calcul du nombre total de pages
        const totalPages = Math.ceil(total / limit);

        // Requête pour récupérer les vétérinaires avec la pagination
        const queryDocteursTunisie = `
            SELECT 
                dt.Name AS name,
                dt.Phone AS phone_number,
                dt.adresse AS Adresse_exacte,
                dt.Location AS ville
            FROM 
                laboratoireanalysemedicale dt
            LIMIT ? OFFSET ?
        `;

        // Exécution de la requête
        const [results] = await db.query(queryDocteursTunisie, queryParams);

        // Vérifier s'il y a des résultats
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun vétérinaire trouvé.' });
        }

        // Calcul de la page actuelle
        const currentPage = Math.floor(offset / limit) + 1;

        // Retour des résultats au client avec la pagination
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des vétérinaires:', error);
        return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
};
const getclinics = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;  // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [limit, offset]; // Paramètres pour la requête

    try {
        // Requête pour récupérer le nombre total de vétérinaires
        const totalCountQuery = `
        SELECT COUNT(*) AS totalCount
        FROM  cliniques dt
    `;
    

        // Exécution de la requête pour obtenir le total
        const [totalCountResult] = await db.query(totalCountQuery);
        const total = totalCountResult[0].totalCount;  // Total des vétérinaires

        // Calcul du nombre total de pages
        const totalPages = Math.ceil(total / limit);

        // Requête pour récupérer les vétérinaires avec la pagination
        const queryDocteursTunisie = `
            SELECT 
                dt.Name AS name,
                dt.Phone AS phone_number,
                dt.adresse AS Adresse_exacte,
                dt.Location AS ville,
                  dt.Pays AS pays 

            FROM 
                 cliniques dt
            LIMIT ? OFFSET ?
        `;

        // Exécution de la requête
        const [results] = await db.query(queryDocteursTunisie, queryParams);

        // Vérifier s'il y a des résultats
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun vétérinaire trouvé.' });
        }

        // Calcul de la page actuelle
        const currentPage = Math.floor(offset / limit) + 1;

        // Retour des résultats au client avec la pagination
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des vétérinaires:', error);
        return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
};
const getDoctorsByIdTeleconsultation = async (req, res) => {
    const doctorId = req.query.doctor_id;

    // Valider doctor_id
    if (!doctorId) {
        return res.status(400).json({ error: 'Le doctor_id doit être un entier valide.' });
    }

    try {
        // Requête pour les jours de disponibilité (sans pause ni durée)
        const daysQuery = `
            SELECT 
                day,
                start_at,
                end_at
            FROM 
                availability_hours
            WHERE 
                doctor_id = ? AND onligne = 1;
        `;
        const [daysResults] = await db.query(daysQuery, [doctorId]);

        // Requête pour les pauses et la durée
        const pausesQuery = `
        SELECT 
            pause_from AS pause_start,
            pause_to AS pause_end,
            session_duration AS duree
        FROM 
            availability_hours
        WHERE 
            doctor_id = ? AND onligne = 1;
    `;
    const [pausesResults] = await db.query(pausesQuery, [doctorId]);

    // Si des pauses sont récupérées, on en sélectionne une seule (par exemple, la première)
    const uniquePause = pausesResults.length > 0 ? {
        pause_start: pausesResults[0].pause_start,
        pause_end: pausesResults[0].pause_end,
     // duree: pausesResults[0].duree
    } : null;
    // Extraire les durées des pauses
    const uniqueDuree = pausesResults.length > 0 ? pausesResults[0].duree : null;
    // Requête pour récupérer les vacances
    const holidaysQuery = ` SELECT 
            dateDebut AS holiday_from,
            dateFin AS holiday_to,
            type AS holiday_type,
            raison AS holiday_reason
        FROM 
            vacance
        WHERE 
            doctor_id = ?;
    `;
    const [holidaysResults] = await db.query(holidaysQuery, [doctorId]);

    // Requête pour récupérer les indisponibilités
    const unavailableQuery = `
        SELECT 
            start_at AS indisponible_date_debut,
            ends_at AS indisponible_date_end
        FROM 
            appointments
        WHERE 
            doctor_id = ?;
    `;
    const [unavailableResults] = await db.query(unavailableQuery, [doctorId]);

    const urgence = `SELECT 
     jour , heurDebut, heurFin
    FROM 
    doctor_urgency
WHERE 
    doctor_id = ?;

   `;
   const [urgenceResults] = await db.query(urgence, [doctorId]);

    // Formatage des données pour affichage local
    const formattedHolidays = holidaysResults.map(holiday => ({
        ...holiday,
        holiday_from: new Date(holiday.holiday_from).toLocaleString('fr-FR', { timeZone: 'Africa/Tunis' }),
        holiday_to: new Date(holiday.holiday_to).toLocaleString('fr-FR', { timeZone: 'Africa/Tunis' })
    }));

//    const formattedUnavailable = unavailableResults.map(ind => ({
  //      ...ind,
    //    indisponible_date_debut: new Date(ind.indisponible_date_debut).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }) + ' ' + new Date(ind.indisponible_date_debut).toLocaleTimeString('fr-FR'>
      //  indisponible_date_end: new Date(ind.indisponible_date_end).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }) + ' ' + new Date(ind.indisponible_date_end).toLocaleTimeString('fr-FR', { ti>
  //  }));
  const today = new Date();
    const filteredUnavailable = unavailableResults.filter(ind => {
        const startDate = new Date(ind.indisponible_date_debut);
        return startDate >= today;
    });

    const formattedUnavailable = filteredUnavailable.map(ind => ({
        ...ind,
        indisponible_date_debut: new Date(ind.indisponible_date_debut).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' })
 + ' ' + new Date(ind.indisponible_date_debut).toLocaleTimeString('fr-FR',  { timeZone: 'Africa/Tunis' }) ,

       indisponible_date_end: new Date(ind.indisponible_date_end).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }) +' '+
       new Date(ind.indisponible_date_end).toLocaleTimeString('fr-FR', {  timeZone: 'Africa/Tunis'     })
}));

    const formattedUrgence = urgenceResults.map(inds => ({
        ...inds,
        jour: new Date(inds.jour).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' }), // Format jour as date
        heurDebut: new Date('1970-01-01T' + inds.heurDebut ).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' }), // Format heurDebut as time
        heurFin: new Date('1970-01-01T' + inds.heurFin ).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' }) // Format heurFin as time
    }));
   
   
        res.json({
            days: daysResults,
            pauses: uniquePause,
            duree :uniqueDuree,
            holidays: formattedHolidays,
            urgence :formattedUrgence ,
            indisponibles: formattedUnavailable
        });
    } catch (err) {
        console.error(err); // Debugging
        return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
};
const getDoctorsByIdTeleconsultations = async (req, res) => {
    const doctorId = req.query.doctor_id; // Retrieve the doctor's ID

    // Check if doctorId is provided
    if (!doctorId) {
        return res.status(400).json({ error: 'Le doctor_id est requis.' });
    }

    // Prepare the SQL query
    const query = `SELECT day, start_at, end_at FROM availability_hours WHERE doctor_id = ? AND onligne = 1;`;

    try {
        // Execute the query
        const [results] = await db.query(query, [doctorId]);

        // Check if any results were found
        if (results.length === 0) {
            return res.status(200).json({ message: 'Aucune disponibilité trouvée pour ce médecin.' });
        }

        // Return the results
        res.json(results);
    } catch (err) {
        console.error(err); // For debugging
        return res.status(500).json({ error: 'Erreur lors de la récupération des disponibilités.' });
    }
};
const getAllDoctorsAndDocteursTunisie = async (req, res) => {
    // Requête pour la table `doctors`
    let queryDoctors = `
        SELECT  
            d.id AS id_doctor,
            d.name AS name,
            d.doctor_photo,
            d.enable_online_consultation,
            d.description,
            d.horaires,
            d.cabinet_photo,
            d.created_at,
            a.title AS title,
            usr.phone_number,
            addr.ville,
            addr.pays,addr.gouvernorat,
d.id_aleatoire AS aleatoire ,            
            addr.address AS adresse_exacte,
            JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name)) AS specialities,
            'conventionné' AS type
        FROM 
            doctors d 
        LEFT JOIN 
            doctor_specialities ds ON d.id = ds.doctor_id 
        LEFT JOIN 
            specialities s ON ds.speciality_id = s.id 
        LEFT JOIN 
            experiences a ON d.id = a.doctor_id 
        LEFT JOIN 
            users usr ON d.user_id = usr.id 
        LEFT JOIN 
            addresses addr ON usr.id = addr.user_id
        GROUP BY  
            d.id, d.name, d.doctor_photo, d.enable_online_consultation, d.description,
            d.horaires, d.cabinet_photo, d.created_at, a.title, usr.phone_number,
            addr.ville, addr.pays, addr.address,addr.gouvernorat
    `;

    // Requête pour la table `docteurs_tunisie`
    let queryDocteursTunisie = `
        SELECT 
            dt.id AS id_doctor,
            dt.name AS name,
            NULL AS doctor_photo,
            NULL AS enable_online_consultation,
            NULL AS description,
            NULL AS horaires,
            NULL AS cabinet_photo,
            NULL AS created_at,
            NULL AS title,
            dt.Phone AS phone_number,
dt.gouvernorat AS gouvernorat ,
            dt.ville AS ville,
            dt.Pays AS pays,
           dt.id_aleatoire AS aleatoire ,
            dt.adresse AS adresse_exacte,
            dt.Sector AS specialites,
            'non-conventionné' AS type
        FROM 
            docteurs_tunisie dt
    `;

    try {
        // Exécution des requêtes
        const [resultsDoctors] = await db.query(queryDoctors);
        const [resultsDocteursTunisie] = await db.query(queryDocteursTunisie);

        // Combiner les résultats
        const results = [...resultsDoctors, ...resultsDocteursTunisie].filter(result => {
            // Exclure les médecins "Demo Doctor" et vérifier les champs
            if (result.name && result.name.toLowerCase().includes('demo doctor')) return false;
            if (!result.ville || !result.pays) return false;
            return true;
        });

        // Formater les spécialités si besoin
        results.forEach(result => {
            if (result.specialities && typeof result.specialities === 'string') {
                try {
                    result.specialities = JSON.parse(result.specialities);
                } catch {
                    result.specialities = [];
                }
            }
        });

        res.json(results);
    } catch (err) {
        console.error('Erreur lors de la récupération des médecins:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération des médecins.' });
    }
};

const searchDoctors = async (req, res) => {
    try {
        const { query, position } = req.query; // Récupération des paramètres de la requête utilisateur

        if (!query || query.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez fournir une chaîne de recherche.',
            });
        }

        // Gestion des positions (début, fin, ou n'importe où)
        let searchPattern;
        switch (position) {
            case 'start': // Lettre(s) au début
                searchPattern = `${query}%`;
                break;
            case 'end': // Lettre(s) à la fin
                searchPattern = `%${query}`;
                break;
            case 'any': // Lettre(s) n'importe où
            default:
                searchPattern = `%${query}%`;
                break;
        }

        // Requête SQL pour rechercher dans les deux tables avec UNION
        const sql = `
        (
            SELECT 
                d.name AS name, 
                'doctors' AS source,
                d.doctor_photo,d.id_aleatoire,addr.gouvernorat ,
                JSON_ARRAYAGG(JSON_OBJECT('name', s.name)) AS specialities
            FROM 
                doctors d
            LEFT JOIN 
                doctor_specialities ds ON d.id = ds.doctor_id
            LEFT JOIN 
                specialities s ON ds.speciality_id = s.id
LEFT JOIN 
            users usr ON d.user_id = usr.id 
  LEFT JOIN 
            addresses addr ON usr.id = addr.user_id 
            WHERE
                LOWER(JSON_EXTRACT(d.name, '$.fr')) LIKE LOWER(CONCAT('%', ?, '%'))
 
                
            GROUP BY 
                d.name, d.doctor_photo,d.id_aleatoire,addr.gouvernorat
        )
        UNION
        (
            SELECT 
                t.Name AS name,
                'docteurs_tunisie' AS source,
                NULL AS doctor_photo,t.id_aleatoire,t.gouvernorat,
                t.Sector AS specialities 
            FROM 
                docteurs_tunisie t
            WHERE 
                           LOWER(t.Name) LIKE LOWER(CONCAT('%', ?, '%'))

        )
        
        `;

        // Exécution de la requête avec le pattern calculé
        const [results] = await db.query(sql, [searchPattern, searchPattern]);

        // Vérification si des résultats sont trouvés
        if (results.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'Aucun docteur trouvé avec les lettres fournies.',
            });
        }

        // Retour des résultats combinés
        res.json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur.',
        });
    }
}
const getCitiesByGovernorates = async (req, res) => {
    const {gouvernorat } = req.params; // Récupérer le gouvernorat des paramètres d'URL

    if (!gouvernorat) {
        return res.status(400).json({ message: "Le gouvernorat est requis." });
    }

    const query = `
        SELECT DISTINCT (ville) 
FROM docteurs_tunisie 
WHERE gouvernorat LIKE CONCAT('%', ?, '%');


    `;

    try {
        // Exécuter la requête SQL avec le gouvernorat donné
        const [results] = await db.query(query, [gouvernorat]);

        if (results.length === 0) {
            return res.status(404).json({ message: "Aucune ville trouvée pour ce gouvernorat." });
        }

        // Retourner les villes sous forme de tableau
        const villes = results.map(row => row.ville);
        res.status(200).json(villes);
    } catch (error) {
        console.error("Erreur lors de la récupération des villes :", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
};
const getCitiesByGovernorate = async (req, res) => {
    const { gouvernorat } = req.params; // Récupérer le gouvernorat des paramètres d'URL

    // Construire la requête SQL en fonction de la présence du gouvernorat
    const query = gouvernorat
        ? `
            SELECT DISTINCT ville 
            FROM docteurs_tunisie 
            WHERE gouvernorat LIKE CONCAT('%', ?, '%');
        `
        : `
            SELECT DISTINCT ville 
            FROM docteurs_tunisie;
        `;

    try {
        // Exécuter la requête SQL avec ou sans gouvernorat
        const [results] = gouvernorat
            ? await db.query(query, [gouvernorat])
            : await db.query(query);

        if (results.length === 0) {
            return res.status(404).json({ message: gouvernorat ? "Aucune ville trouvée pour ce gouvernorat." : "Aucune ville trouvée." });
        }

        // Retourner les villes sous forme de tableau
        const villes = results.map(row => row.ville);
        res.status(200).json(villes);
    } catch (error) {
        console.error("Erreur lors de la récupération des villes :", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
};
const getPatientData = async (req, res) => {
    const patientId = req.params.patientId;

    try {
        const [rows] = await db.query(`
            SELECT 
                p.type AS prescription_type, 
                p.observation AS prescription_observation, 
                c.dateConsultation AS consultation_date, 
                d.name AS doctor_name, 
                u.first_name AS patient_first_name, 
                u.last_name AS patient_last_name, 
                JSON_ARRAYAGG(JSON_OBJECT('name', s.name)) AS specialities,
                addr.ville AS ville,
                addr.pays AS pays,
                addr.address AS adress
            FROM 
                prescriptions p 
            LEFT JOIN 
                consultations c ON p.consultation_id = c.id
            LEFT JOIN 
                patients u ON c.patient_id = u.id
            LEFT JOIN 
                doctors d ON c.user_id = d.user_id
            LEFT JOIN 
                doctor_specialities ds ON d.id = ds.doctor_id
            LEFT JOIN 
                specialities s ON ds.speciality_id = s.id
            LEFT JOIN 
                addresses addr ON c.user_id = addr.user_id
            WHERE 
                c.patient_id = ?
            GROUP BY
                p.type, p.date, p.observation, c.dateConsultation, d.name, u.first_name, u.last_name, addr.ville, addr.pays, addr.address
        `, [patientId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Aucune donnée trouvée pour le patient." });
        }

        // Convertir la date de consultation au format local (Africa/Tunis) en JJ/MM/AAAA HH:mm:ss
        rows.forEach(row => {
            if (row.consultation_date) {
                const options = {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone: 'Africa/Tunis',
                };
                row.consultation_date = new Intl.DateTimeFormat('fr-FR', options).format(new Date(row.consultation_date));
            }
        });

        res.status(200).json(rows);
    } catch (error) {
        console.error("Erreur lors de l'exécution de la requête :", error);
        res.status(500).json({ error: "Erreur lors de la récupération des données." });
    }
};
//const puppeteer = require('puppeteer');
//const path = require('path');
//const fs = require('fs');

const generatePDF = async (req, res) => {
    try {
        // Exécution de la requête SQL pour récupérer les données nécessaires
        const [rows] = await db.query(`
            SELECT 
                p.type AS prescription_type, 
                p.date AS prescription_date, 
                p.observation AS prescription_observation, 
                c.dateConsultation AS consultation_date, 
                c.raison AS consultation_reason, 
                c.motif AS consultation_motif, 
                d.name AS doctor_name, 
                d.diplome AS diplome,
                d.matricule_CNAM As matricule_CNAM,
                d.numOrdre AS numOrdre,
                u.first_name AS patient_first_name, 
                u.last_name AS patient_last_name, 
                JSON_ARRAYAGG(JSON_OBJECT('name', s.name)) AS specialities,
                addr.ville AS ville,
                addr.pays AS pays,
                us.phone_number AS doctor_phone_number, 
                addr.address AS adress,
                JSON_ARRAYAGG(JSON_OBJECT('name', m.NOM_COMMERCIAL, 'dosage', pm.dosage, 'nb_de_jours', pm.nb_de_jours ,'horaire',pm.horaire ,'nb_de_fois' ,pm.nb_de_fois)) AS medications,
                COUNT(pm.medicament_CODE_PCT) AS number_of_medications
            FROM 
                prescriptions p
            LEFT JOIN 
                consultations c ON p.consultation_id = c.id
            LEFT JOIN 
                patients u ON c.patient_id = u.id
            LEFT JOIN 
                doctors d ON c.user_id = d.user_id
            LEFT JOIN 
                doctor_specialities ds ON d.id = ds.doctor_id
            LEFT JOIN 
                specialities s ON ds.speciality_id = s.id
            LEFT JOIN 
                addresses addr ON c.user_id = addr.user_id
            LEFT JOIN 
                medicament_prescription pm ON p.id = pm.prescription_id
            LEFT JOIN 
                medicaments m ON pm.medicament_CODE_PCT = m.CODE_PCT
            LEFT JOIN 
                medicament_prescription mp ON pm.medicament_CODE_PCT = mp.id
            LEFT JOIN 
                users us ON d.user_id = us.id
            WHERE 
                c.patient_id = ?
            GROUP BY
                p.type, p.date, p.observation, c.dateConsultation, c.raison, c.motif, d.name, u.first_name, u.last_name, addr.ville, addr.pays, addr.address, d.diplome ,us.phone_number ,  d.matricule_CNAM , d.numOrdre;`, 
            [req.body.record_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Aucune donnée trouvée pour l'ID donné." });
        }

        const data = rows[0];
        const consultationDate = formatDateToFrench(data.consultation_date || ''); // Exemple avec consultation_date
        const patientName = safeJsonParse(data.patient_first_name)?.fr || 'Nom non spécifié';
        const patientLastName = safeJsonParse(data.patient_last_name)?.fr || 'Nom non spécifié';

        // Assurez-vous que vous avez bien accès aux données
        const doctorName = safeJsonParse(data.doctor_name)?.fr || 'Nom non spécifié';
        const specialityNames = Array.isArray(data.specialities) 
            ? data.specialities.map(speciality => {
                return safeJsonParse(speciality.name)?.fr || 'Non spécifiée';
            }).join(', ') 
            : 'Non spécifiée';
        
        const adresseName = safeJsonParse(data.adress)?.fr || 'Non spécifiée';
        const villeName = safeJsonParse(data.ville)?.fr || 'Non spécifiée';
        const paysName = safeJsonParse(data.pays)?.fr || 'Non spécifié';
        console.log("Valeur de data.medications :", data.medications);

        const medications = (data.medications || '[]');

        // Contenu HTML dynamique basé sur les données SQL
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 40px;
                    max-width: 21cm;
                    margin: 0 auto;
                    padding-left: 20px;
                    padding-right: 20px;
                }
                .header-left h1, .header-left p, .header-right p {
                    margin: 0;
                }
                .patient-info {
                    margin-bottom: 40px;
                }
                .medications {
                    margin-top: 20px;
                }
                .instructions {
                    margin-top: 20px;
                    font-style: italic;
                }
               .footer {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 80px;
                    font-size: 1.1em;
                    padding-left: 20px;
                    padding-right: 20px;
                }

                .signature {
                    text-align: center;
                    margin-top: 30px;
                }

                .signature p:first-child {
                    margin-bottom: 10px;
                }

                .signature .line {
                    display: inline-block;
                    width: 150px;
                    border-top: 2px solid #000;
                    margin-top: 10px;
                }

            </style>
        </head>
        <body>
            <header class="header">
                <div class="header-left">
                    <br><br>
                    <h1>Dr. ${doctorName}</h1>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 0; text-align: left;">Médecin ${specialityNames || 'Non spécifiée'}</td>
                            <td style="padding: 0; text-align: right;">${adresseName || 'Non spécifiée'}</td>
                        </tr>
                    </table>
                    <div style="border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 0; text-align: left;">${data.diplome || 'Non spécifiée'} <br>
                                    N° d'order: ${data.numOrdre || 'Non spécifiée'} </td>
                                <td style="padding: 0; text-align: right;"><strong>Tél :</strong> ${data.doctor_phone_number || 'Non spécifiée'}<br>  <br></td>
                            </tr>
                        </table>
                    </div>
                </div>
            </header>
            <div class="header">
                <div style="text-align: center">
                    <p><strong>Matricule CNAM: </strong>${data.matricule_CNAM}</p>
                </div>
                <p style="padding: 0; text-align: right;"><strong>Le </strong>${consultationDate || 'Non spécifiée'}<br>  <br></p>
            </div>
            <div>
                <p><strong>Mr/Mme ${patientName} ${patientLastName}</strong></p>
                <br>
                <h1>${data.prescription_type || 'Non spécifiée'}</h1>
                <br>
                <p>
                    ${medications.map(med => `
                        <p>${med.name} - ${med.dosage}, ${med.nb_de_fois}, ${med.horaire} ${med.nb_de_jours}</p>
                    `).join('')}
                </p>
                <p><strong>Observation :</strong> ${data.prescription_observation || 'Aucune'}</p>
                <p><strong>Total Médicaments: </strong>${data.number_of_medications}</p>
            </div>
            <div class="footer">
                <div class="signature">
                    <p>Signature</p>
                    <div class="line"></div>
                </div>
            </div>
        </body>
        </html>`;

        // Lancer Puppeteer pour générer le PDF à partir du contenu HTML
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Arguments nécessaires pour éviter l'erreur "running as root"
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Définir le répertoire où enregistrer les PDF
        const pdfDir = path.join(__dirname, '../pdfs');
        const pdfPath = path.join(pdfDir, `ordonnance-${Date.now()}.pdf`);

        // Créer le répertoire si nécessaire
        if (!fs.existsSync(pdfDir)) {
            fs.mkdirSync(pdfDir, { recursive: true });
        }

        // Générer le PDF
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
        await browser.close();

        // Répondre avec l'URL du fichier PDF généré
        res.status(200).json({ url: `https://wic-doctor.com:3004/pdfs/${path.basename(pdfPath)}` });

    } catch (error) {
        console.error('Erreur lors de la génération du PDF :', error);
        res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
};


const generatePDFss = async (req, res) => {
    try {
        const [rows] = await db.query(`
         SELECT 
    p.type AS prescription_type, 
    p.date AS prescription_date, 
    p.observation AS prescription_observation, 
    c.dateConsultation AS consultation_date, 
    c.raison AS consultation_reason, 
    c.motif AS consultation_motif, 
    d.name AS doctor_name, 
    d.diplome AS diplome,
    d.matricule_CNAM As matricule_CNAM ,d.numOrdre AS numOrdre ,
    u.first_name AS patient_first_name, 
    u.last_name AS patient_last_name, 
    JSON_ARRAYAGG(JSON_OBJECT('name', s.name)) AS specialities,
    addr.ville AS ville,
    addr.pays AS pays,    us.phone_number AS doctor_phone_number, 

    addr.address AS adress,
    JSON_ARRAYAGG(JSON_OBJECT('name', m.NOM_COMMERCIAL, 'dosage', pm.dosage, 'nb_de_jours', pm.nb_de_jours ,'horaire',pm.horaire ,'nb_de_fois' ,pm.nb_de_fois)) AS medications ,
    COUNT(pm.medicament_CODE_PCT) AS number_of_medications
FROM 
    prescriptions p
LEFT JOIN 
    consultations c ON p.consultation_id = c.id
LEFT JOIN 
    patients u ON c.patient_id = u.id
LEFT JOIN 
    doctors d ON c.user_id = d.user_id
LEFT JOIN 
    doctor_specialities ds ON d.id = ds.doctor_id
LEFT JOIN 
    specialities s ON ds.speciality_id = s.id
LEFT JOIN 
    addresses addr ON c.user_id = addr.user_id
LEFT JOIN 
   medicament_prescription pm ON p.id = pm.prescription_id
LEFT JOIN 
    medicaments m ON pm.medicament_CODE_PCT = m.CODE_PCT
LEFT JOIN 
    medicament_prescription mp ON pm.medicament_CODE_PCT = mp.id
    LEFT JOIN 
    users us ON d.user_id = us.id
WHERE 
    c.patient_id = ?
GROUP BY
    p.type, p.date, p.observation, c.dateConsultation, c.raison, c.motif, d.name, u.first_name, u.last_name, addr.ville, addr.pays, addr.address, d.diplome ,us.phone_number ,  d.matricule_CNAM , d.numOrdre ;`, 
            [req.body.record_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Aucune donnée trouvée pour l'ID donné." });
        }

        const data = rows[0];
        const consultationDate = formatDateToFrench(data.consultation_date || ''); // Exemple avec consultation_date
        const patientName = safeJsonParse(data.patient_first_name)?.fr || 'Nom non spécifié';
        const patientLastName = safeJsonParse(data.patient_last_name)?.fr || 'Nom non spécifié';

        // Assurez-vous que vous avez bien accès aux données
        const doctorName = safeJsonParse(data.doctor_name)?.fr || 'Nom non spécifié';
        const specialityNames = Array.isArray(data.specialities) 
            ? data.specialities.map(speciality => {
                return safeJsonParse(speciality.name)?.fr || 'Non spécifiée';
            }).join(', ') 
            : 'Non spécifiée';
        
        const adresseName = safeJsonParse(data.adress)?.fr || 'Non spécifiée';
        const villeName = safeJsonParse(data.ville)?.fr || 'Non spécifiée';
        const paysName = safeJsonParse(data.pays)?.fr || 'Non spécifié';
        console.log("Valeur de data.medications :", data.medications);

      const medications = (data.medications || '[]');

        // Contenu HTML dynamique basé sur les données SQL
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 40px;
                    max-width: 21cm;
                    margin: 0 auto;
                       padding-left: 20px; /* Marge gauche */
            padding-right: 20px;
                }
                .header-left h1, .header-left p, .header-right p {
                    margin: 0;
                }
                .patient-info {
                    margin-bottom: 40px;
                }
                .medications {
                    margin-top: 20px;
                }
                .instructions {
                    margin-top: 20px;
                    font-style: italic;
                }
               .footer {
    display: flex;
    justify-content: flex-end; /* Aligne la signature à droite */
    margin-top: 80px;
    font-size: 1.1em;
      padding-left: 20px; /* Marge gauche */
            padding-right: 20px;
}

.signature {
    text-align: center; /* Centrer le texte dans la signature */
    margin-top: 30px;
}

.signature p:first-child {
    margin-bottom: 10px; /* Ajoute un espace entre "Signature" et la ligne */
}

.signature .line {
    display: inline-block;
    width: 150px; /* Largeur personnalisée pour la ligne de signature */
    border-top: 2px solid #000; /* Une ligne plus élégante pour la signature */
    margin-top: 10px;
}

            </style>
        </head>
        <body>
            <header class="header">
                <div class="header-left">
                    <br><br>
                    <h1>Dr. ${doctorName}</h1>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 0; text-align: left;">Médecin   ${specialityNames || 'Non spécifiée'}</td>
                            <td style="padding: 0; text-align: right;">  ${adresseName || 'Non spécifiée'}</td>
                        </tr>
                    </table>
                

                    <div style="border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                            <td style="padding: 0; text-align: left;">  ${data.diplome || 'Non spécifiée'} <br>
                                        N° d'order: ${data.numOrdre || 'Non spécifiée'} </td>

                        <td style="padding: 0; text-align: right;"><strong>Tél :</strong>  ${data.doctor_phone_number || 'Non spécifiée'}<br>  <br>
</td>

     </tr>
                    

                        </table>
                    </div>
                </div>
            </header>
            <div class="header">
                
<div style="text-align: center">
    <p><strong>Matricule CNAM: </strong>${data.matricule_CNAM}</p>
</div>


  <p style="padding: 0; text-align: right;"><strong>Le </strong>  ${consultationDate || 'Non spécifiée'}<br>  <br></p>

            
            </div>
            <div>
                <p><strong>Mr/Mme ${patientName} ${patientLastName}</p>
                <br> 
                <h1>${data.prescription_type || 'Non spécifiée'}</h1>
                <br>
                 <p>
                ${medications.map(med => `
                    <p>${med.name } - ${med.dosage}, ${med.nb_de_fois}, ${med.horaire} ${med.nb_de_jours}
                  
                `).join('')}
            </p>
                <p><strong>Observation :</strong> ${data.prescription_observation || 'Aucune'}</p>
                <p><strong>Total Médicaments: </strong> ${data.number_of_medications}</p>

            </div>
         <div class="footer">
    <div class="signature">
        <p>Signature</p>
        <div class="line"></div>
    </div>
</div>

        </body>
        </html>`;
        console.log("Nombre total de médicaments :", data.number_of_medications);

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const pdfDir = path.join(__dirname, '../pdfs');
        const pdfPath = path.join(pdfDir, `ordonnance-${Date.now()}.pdf`);

        if (!fs.existsSync(pdfDir)) {
            fs.mkdirSync(pdfDir, { recursive: true });
        }

        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
        await browser.close();

        res.status(200).json({ url: `https://wic-doctor.com:3004/${path.basename(pdfPath)}` });

    } catch (error) {
        console.error('Erreur lors de la génération du PDF :', error);
        res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
};
const getambulancess = async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;  // Nombre de résultats par page
    const offset = parseInt(req.query.offset) || 0; // Décalage des résultats
    const queryParams = [limit, offset]; // Paramètres pour la requête

    try {
        // Requête pour récupérer le nombre total de vétérinaires
        const totalCountQuery = `
            SELECT COUNT(*) AS totalCount
            FROM 	ambulance_privé
        `;

        // Exécution de la requête pour obtenir le total
        const [totalCountResult] = await db.query(totalCountQuery);
        const total = totalCountResult[0].totalCount;  // Total des vétérinaires

        // Calcul du nombre total de pages
        const totalPages = Math.ceil(total / limit);

        // Requête pour récupérer les vétérinaires avec la pagination
        const queryDocteursTunisie = `
            SELECT 
                dt.name AS name ,
                dt.promoteur AS promoteur ,
                dt.adresse AS adresse_exact ,
                dt.tel AS tel ,
                dt.fax AS fax

            FROM 
                	ambulance_privé dt 
            LIMIT ? OFFSET ?
        `;

        // Exécution de la requête
        const [results] = await db.query(queryDocteursTunisie, queryParams);

        // Vérifier s'il y a des résultats
        if (results.length === 0) {
            return res.status(404).json({ message: 'Aucun vétérinaire trouvé.' });
        }

        // Calcul de la page actuelle
        const currentPage = Math.floor(offset / limit) + 1;

        // Retour des résultats au client avec la pagination
        return res.json({
            total,
            totalPages,
            currentPage,
            data: results,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des vétérinaires:', error);
        return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
};



module.exports = {
    specialitespardoctor,getclinics,getbanquesangs ,
    getalldoctors,getpharmacies,getlaboratoire,
    getDoctorsparvillepaysspecialites,getPatientData , 
//envoyerRappelEmail,
    getDoctorsById,gethopiteaux,getDoctorsByIdTeleconsultation,
    getadressempas,getAllAnnuaires,
    getvilles,getpays,getmotif,gethistoriqu,
 insertAppointmentteleconsultation ,
getblogs,getveterinaires,searchDoctors,generatePDF,
    forgs,rests,insertAppointment,getplusprochedoc, getCitiesByGovernorate,
    getAppointmentsByPatientId , updateAppointment ,
 getDoctorById , cancelAppointment , sendSMSBeforeAppointment ,verifierEtEnvoyerRappels , annulerRendezVous
,getAllDoctorsAndDocteursTunisie    ,confirmerRendezVous , verifierEtEnvoyerSmsRappels , sendEmail ,getinfermiers ,getambulancess
}
