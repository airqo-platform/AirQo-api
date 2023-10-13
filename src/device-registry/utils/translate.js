const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
    `${constants.ENVIRONMENT} -- create-health-tip-util`
);
const httpStatus = require("http-status");
const { Translate } = require('@google-cloud/translate').v2;

const translate = new Translate();

const translateUtil = {
    translateTips: async (healthTips, targetLanguage) => {
        try {

            const translatedHealthTips = [
                {
                    "_id": "64283f6402cbab001e628296",
                    "title": "Pour tout le monde",
                    "description": "Si vous devez passer beaucoup de temps dehors, les masques jetables comme le N95 sont utiles.",
                    "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/health-tip-images%2Ffamily.png?alt=media&token=8cdc93c0-9f3f-42db-b9a1-7dbdf73c5519",
                    "aqi_category": {
                        "min": 250.5,
                        "max": 500
                    }
                },
                {
                    "_id": "64283f4702cbab001e628293",
                    "title": "Pour tout le monde",
                    "description": "Réduisez l’intensité de vos activités de plein air. Essayez de rester à l’intérieur jusqu’à ce que la qualité de l’air s’améliore.",
                    "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/health-tip-images%2Ffamily.png?alt=media&token=8cdc93c0-9f3f-42db-b9a1-7dbdf73c5519",
                    "aqi_category": {
                        "min": 150.5,
                        "max": 250.49
                    }
                },
                {
                    "_id": "64283ec79c7eaf001ea5e9c9",
                    "title": "Pour tout le monde",
                    "description": "Évitez les activités qui vous font respirer plus rapidement. Aujourd’hui est le jour idéal pour passer une lecture à l’intérieur.",
                    "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/health-tip-images%2Ffamily.png?alt=media&token=8cdc93c0-9f3f-42db-b9a1-7dbdf73c5519",
                    "aqi_category": {
                        "min": 55.5,
                        "max": 150.49
                    }
                },
                {
                    "_id": "64283e6e9c7eaf001ea5e9b7",
                    "title": "Pour les enfants",
                    "description": "Réduisez l’intensité de vos activités de plein air.",
                    "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/health-tip-images%2Fchild.png?alt=media&token=0c983e57-90df-425d-9bd4-294dc0eacada",
                    "aqi_category": {
                        "min": 35.5,
                        "max": 55.49
                    }
                },
                {
                    "_id": "64283e529c7eaf001ea5e9b4",
                    "title": "Pour les personnes âgées",
                    "description": "Réduisez l’intensité de vos activités de plein air.",
                    "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/health-tip-images%2Fold_man.png?alt=media&token=428ea46f-86e0-4425-b050-80d1440aace5",
                    "aqi_category": {
                        "min": 35.5,
                        "max": 55.49
                    }
                },
                {
                    "_id": "64283e11e57ef7001e74008c",
                    "title": "Pour les femmes enceintes",
                    "description": "Réduisez l’intensité de vos activités de plein air pour rester en bonne santé, vous et votre bébé.",
                    "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/health-tip-images%2Fpregnant_woman.png?alt=media&token=1c46abad-d52d-4704-a977-71830e1c406a",
                    "aqi_category": {
                        "min": 35.5,
                        "max": 55.49
                    }
                },
                {
                    "_id": "64283dc7e57ef7001e74007d",
                    "title": "Pour les personnes ayant des problèmes respiratoires",
                    "description": "Réduisez les exercices intenses. Allez-y doucement si vous ressentez des signes comme la toux.",
                    "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/health-tip-images%2Ffamily.png?alt=media&token=8cdc93c0-9f3f-42db-b9a1-7dbdf73c5519",
                    "aqi_category": {
                        "min": 35.5,
                        "max": 55.49
                    }
                },
                {
                    "_id": "64283d749c7eaf001ea5e99d",
                    "title": "Pour les personnes âgées",
                    "description": "Réduisez l’intensité de vos activités de plein air.",
                    "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/health-tip-images%2Fold_man.png?alt=media&token=428ea46f-86e0-4425-b050-80d1440aace5",
                    "aqi_category": {
                        "min": 12.1,
                        "max": 35.49
                    }
                },
                {
                    "_id": "64283d37b2e9e5001e69c872",
                    "title": "Pour les femmes enceintes",
                    "description": "Réduisez l’intensité de vos activités de plein air pour rester en bonne santé, vous et votre bébé.",
                    "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/health-tip-images%2Fpregnant_woman.png?alt=media&token=1c46abad-d52d-4704-a977-71830e1c406a",
                    "aqi_category": {
                        "min": 12.1,
                        "max": 35.49
                    }
                },
                {
                    "_id": "64283ce9e82a77001e55c0b5",
                    "title": "Pour tout le monde",
                    "description": "Aujourd'hui est une journée idéale pour les activités de plein air.",
                    "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/health-tip-images%2Ffamily.png?alt=media&token=8cdc93c0-9f3f-42db-b9a1-7dbdf73c5519",
                    "aqi_category": {
                        "min": 12.1,
                        "max": 35.49
                    }
                },
                {
                    "_id": "64283ca1b2e9e5001e69c85f",
                    "title": "Pour tout le monde",
                    "description": "C'est une excellente journée pour sortir et faire de l'exercice. Pensez à réduire le nombre de déplacements en voiture que vous effectuez.",
                    "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/health-tip-images%2Ffamily.png?alt=media&token=8cdc93c0-9f3f-42db-b9a1-7dbdf73c5519",
                    "aqi_category": {
                        "min": 0,
                        "max": 12.09
                    }
                }
            ];

            // for (const healthTip of healthTips) {
            //     const translatedTip = { ...healthTip };
            //     translatedTip.title = await translateText(healthTip.title, targetLanguage);
            //     translatedTip.description = await translateText(healthTip.description, targetLanguage);

            //     translatedHealthTips.push(translatedTip);
            // }

            return {
                success: true,
                message: "Translated Health Tips returned Successfully",
                data: translatedHealthTips,
                status: httpStatus.OK,
            };
        } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
            return {
                success: false,
                message: "Internal Server Error",
                status: httpStatus.INTERNAL_SERVER_ERROR,
                errors: {
                    message: error.message,
                },
            };
        }
    },

    translateLessons: async (lessons, targetLanguage) => {
        try {
            const translatedLessons = [
                {
                    "_id": "64a56f8f20511a001d1b494b",
                    "title": "Mesures que vous pouvez prendre pour réduire la pollution de l’air",
                    "completion_message": "Vous venez de terminer votre première leçon Know Your Air.",
                    "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/app-illustrations%2Fwalk-or-cycle.jpg?alt=media&token=30d7b337-e430-4545-b73e-b3de4d42a9ae",
                    "tasks": [
                        {
                            "_id": "64a5f37320511a001d1b5f97",
                            "title": "Utilisez les transports en commun",
                            "content": "Les gaz d’échappement des véhicules constituent une source majeure de pollution atmosphérique. Moins de voitures sur la route entraîne moins d’émissions.",
                            "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/app-illustrations%2Fpublic-transport.jpg?alt=media&token=932d0941-7d95-4ee7-9ff6-2131f1536382",
                            "createdAt": "2023-07-05T22:49:23.571Z",
                            "updatedAt": "2023-08-21T15:36:02.103Z",
                            "__v": 0,
                            "kya_lesson": "64a56f8f20511a001d1b494b",
                            "task_position": 1
                        },
                        {
                            "_id": "64a5f3cd20511a001d1b5f9c",
                            "title": "Entretenez régulièrement votre voiture/boda boda",
                            "content": "Des inspections régulières peuvent maximiser le rendement énergétique, ce qui réduit les émissions des véhicules.",
                            "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/app-illustrations%2Fservice-your-car.jpg?alt=media&token=5e195938-c95d-4733-a6eb-f50b59c1f123",
                            "createdAt": "2023-07-05T22:50:53.565Z",
                            "updatedAt": "2023-08-21T15:31:31.128Z",
                            "__v": 0,
                            "kya_lesson": "64a56f8f20511a001d1b494b",
                            "task_position": 2
                        },
                        {
                            "_id": "64a5f42320511a001d1b5fa0",
                            "title": "Évitez de faire tourner le moteur de votre voiture au ralenti dans la circulation",
                            "content": "Les véhicules produisent des gaz d’échappement particulièrement malsains. Éteignez votre moteur dans la circulation",
                            "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/app-illustrations%2Favoid-idling-in-traffic.jpg?alt=media&token=e4ace04e-8827-486b-8040-771b0246e836",
                            "createdAt": "2023-07-05T22:52:19.863Z",
                            "updatedAt": "2023-08-21T15:31:43.517Z",
                            "__v": 0,
                            "kya_lesson": "64a56f8f20511a001d1b494b",
                            "task_position": 3
                        },
                        {
                            "_id": "64a5f47b300685001ed6fca9",
                            "title": "Marcher ou faire du vélo",
                            "content": "Marchez ou faites du vélo pour réduire votre empreinte carbone individuelle tout en améliorant votre santé !",
                            "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/app-illustrations%2Fwalk-or-cycle.jpg?alt=media&token=30d7b337-e430-4545-b73e-b3de4d42a9ae",
                            "createdAt": "2023-07-05T22:53:48.696Z",
                            "updatedAt": "2023-08-21T15:31:59.703Z",
                            "__v": 0,
                            "kya_lesson": "64a56f8f20511a001d1b494b",
                            "task_position": 4
                        },
                        {
                            "_id": "64a5f4af49f83e001faa2b50",
                            "title": "Évitez de brûler les déchets",
                            "content": "Brûler vos déchets ménagers est dangereux pour votre santé et notre environnement",
                            "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/app-illustrations%2Fdo-not-burn-rubbish.jpg?alt=media&token=bde1322c-c658-4c0f-97ba-8b73adb45327",
                            "createdAt": "2023-07-05T22:54:40.162Z",
                            "updatedAt": "2023-08-21T15:32:14.216Z",
                            "__v": 0,
                            "kya_lesson": "64a56f8f20511a001d1b494b",
                            "task_position": 5
                        },
                        {
                            "_id": "64a5f4dc300685001ed6fcaf",
                            "title": "Réduisez les produits en plastique à usage unique",
                            "content": "Évitez d'utiliser des sacs en plastique, ils mettent plus de temps à se décomposer. Utilisez des sacs ou des paniers en papier pour vos courses",
                            "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/app-illustrations%2Favoid-single-use-plastics.jpg?alt=media&token=58569894-a2a2-4df2-a741-e9c058a80582",
                            "createdAt": "2023-07-05T22:55:24.266Z",
                            "updatedAt": "2023-08-21T15:32:31.792Z",
                            "__v": 0,
                            "kya_lesson": "64a56f8f20511a001d1b494b",
                            "task_position": 6
                        },
                        {
                            "_id": "64a5725a20511a001d1b4a26",
                            "title": "Devenez un champion de l’air pur",
                            "content": "Rejoignez notre campagne sur la qualité de l'air et plaidez pour un air pur dans votre communauté.",
                            "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/app-illustrations%2Fbe-a-champion.jpg?alt=media&token=621fecbb-a59b-4c39-8015-8150864181e5",
                            "createdAt": "2023-07-05T13:38:34.452Z",
                            "updatedAt": "2023-08-21T15:38:48.917Z",
                            "__v": 0,
                            "kya_lesson": "64a56f8f20511a001d1b494b",
                            "task_position": 7
                        }
                    ]
                }
            ];
            // const translatedLessons = [];

            // for (const lesson of lessons) {
            //     const translatedLesson = { ...lesson };
            //     translatedLesson.title = await translateText(lesson.title, targetLanguage);
            //     translatedLesson.completion_message = await translateText(lesson.completion_message, targetLanguage);
            //     const translatedTasks = [];
            //     for (const task of lesson.tasks) {
            //         const translatedTask = { ...task };
            //         translatedTask.title = await translateText(task.title, targetLanguage);
            //         translatedTask.content = await translateText(task.content, targetLanguage);
            //         translatedTasks.push(translatedTask);
            //     }
            //     translatedLesson.tasks = translatedTasks
            //     translatedLessons.push(translatedLesson);
            // }

            return {
                success: true,
                message: "Translated KYA returned Successfully",
                data: translatedLessons,
                status: httpStatus.OK,
            };
        } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
            console.log(`internal server error -- ${error.message}`);

            return {
                success: false,
                message: "Internal Server Error",
                status: httpStatus.INTERNAL_SERVER_ERROR,
                errors: {
                    message: error.message,
                },
            };
        }
    },

    translateQuizzes: async (quizzes, targetLanguage) => {
        try {

            const translatedQuizzes = [
                {
                    "_id": "64e722d048456f0012137aee",
                    "title": "Découvrez ici vos conseils personnalisés sur la qualité de l’air !",
                    "description": "Répondez à ce quiz sur votre environnement et votre routine quotidienne pour débloquer des conseils personnalisés rien que pour vous !",
                    "completion_message": "Marche à suivre. Vous avez débloqué des recommandations personnalisées sur la qualité de l'air pour vous aider dans votre voyage vers un air pur.",
                    "image": "https://firebasestorage.googleapis.com/v0/b/airqo-250220.appspot.com/o/kya-quiz%2FquizImage.png?alt=media&token=e25845ca-f9c9-43ea-8de8-5e6bd0c8b748",
                    "questions": [
                        {
                            "_id": "64e70c6548456f0012137664",
                            "title": "Quelle méthode de cuisson utilisez-vous à la maison ?",
                            "context": "Environnement de la maison",
                            "question_position": 1,
                            "createdAt": "2023-08-24T07:53:09.500Z",
                            "updatedAt": "2023-09-05T06:59:31.406Z",
                            "__v": 0,
                            "kya_quiz": "64e722d048456f0012137aee",
                            "answers": [
                                {
                                    "_id": "64e763d99be50300138c8c69",
                                    "content": [
                                        "Cuisiner avec du bois de chauffage peut émettre des quantités importantes de polluants atmosphériques.",
                                        "Cuisinez dans une cuisine bien ventilée avec une bonne circulation d’air ou installez une cuisine extérieure si possible.",
                                        "Utilisez un poêle efficace conçu pour brûler du bois de chauffage plus proprement et avec moins de fumée.",
                                        "Envisagez de passer à des cuisinières améliorées qui réduisent les émissions et augmentent le rendement énergétique."
                                    ],
                                    "title": "Bois de chauffage",
                                    "createdAt": "2023-08-24T14:06:17.479Z",
                                    "updatedAt": "2023-08-24T20:13:39.883Z",
                                    "__v": 0,
                                    "kya_question": "64e70c6548456f0012137664"
                                },
                                {
                                    "_id": "64e764005e3f3c0012a932ee",
                                    "content": [
                                        "L’utilisation d’un poêle à charbon pour cuisiner peut libérer des polluants nocifs comme des particules et du monoxyde de carbone.",
                                        "Utilisez un poêle à charbon dans une cuisine bien ventilée ou près d'une fenêtre ouverte.",
                                        "Pendant la cuisson, gardez les portes et les fenêtres ouvertes pour réduire la fumée.",
                                        "Si possible, envisagez de passer à des options de cuisson plus propres pour réduire la pollution de l’air intérieur."
                                    ],
                                    "title": "Poêle à charbon",
                                    "createdAt": "2023-08-24T14:06:56.573Z",
                                    "updatedAt": "2023-09-13T07:52:23.575Z",
                                    "__v": 0,
                                    "kya_question": "64e70c6548456f0012137664"
                                },
                                {
                                    "_id": "64e764139be50300138c8c6d",
                                    "content": [
                                        "L’utilisation d’une cuisinière à gaz est généralement une option plus propre que les combustibles solides.",
                                        "Assurer une ventilation adéquate pour éviter l’accumulation d’émissions de gaz à l’intérieur.",
                                        "Entretenir les cuisinières à gaz et les branchements pour éviter les fuites qui pourraient nuire à la qualité de l’air intérieur."
                                    ],
                                    "title": "Cuisinière à gaz",
                                    "createdAt": "2023-08-24T14:07:15.517Z",
                                    "updatedAt": "2023-08-24T20:13:39.883Z",
                                    "__v": 0,
                                    "kya_question": "64e70c6548456f0012137664"
                                },
                                {
                                    "_id": "64e76425ee3c3e0013724956",
                                    "content": [
                                        "Le biogaz est considéré comme une option de cuisson plus propre.",
                                        "Entretenez régulièrement le système de biogaz pour assurer une production et une combustion efficaces du gaz.",
                                        "Bien que le biogaz soit plus propre, assurez une ventilation adéquate pour éviter toute émission persistante.",
                                        "Suivez les directives du fabricant pour une utilisation sûre et efficace du biogaz."
                                    ],
                                    "title": "Biogaz",
                                    "createdAt": "2023-08-24T14:07:33.853Z",
                                    "updatedAt": "2023-08-24T20:13:39.883Z",
                                    "__v": 0,
                                    "kya_question": "64e70c6548456f0012137664"
                                },
                                {
                                    "_id": "65016a9b52a26200135e2bfd",
                                    "content": [
                                        "Les cuisinières électriques ne produisent aucun polluant direct dans l’air intérieur.",
                                        "Même sans émissions, assurez une ventilation adéquate pour éviter d’autres polluants de l’air intérieur.",
                                        "L’utilisation de cuisinières électriques économes en énergie peut réduire l’impact environnemental global."
                                    ],
                                    "title": "Cuisinière électrique",
                                    "createdAt": "2023-09-13T07:54:03.940Z",
                                    "updatedAt": "2023-09-13T07:55:14.447Z",
                                    "__v": 0,
                                    "kya_question": "64e70c6548456f0012137664"
                                }
                            ]
                        },
                        {
                            "_id": "64e712159953c100130e5663",
                            "title": "Comment éliminer les déchets à la maison ?",
                            "context": "Environnement de la maison",
                            "question_position": 2,
                            "createdAt": "2023-08-24T08:17:25.133Z",
                            "updatedAt": "2023-09-05T07:00:28.409Z",
                            "__v": 0,
                            "kya_quiz": "64e722d048456f0012137aee",
                            "answers": [
                                {
                                    "_id": "64e7652e1fb90d0013a707fe",
                                    "content": [
                                        "Le brûlage des déchets peut libérer divers polluants comme des particules et des substances toxiques.",
                                        "Assurez-vous d'utiliser des méthodes appropriées d'élimination des déchets comme le recyclage, la collecte dans une déchetterie ou le recours à des entreprises de services de collecte des déchets."
                                    ],
                                    "title": "Brûle le",
                                    "createdAt": "2023-08-24T14:11:58.235Z",
                                    "updatedAt": "2023-08-24T20:20:40.759Z",
                                    "__v": 0,
                                    "kya_question": "64e712159953c100130e5663"
                                },
                                {
                                    "_id": "64e7bb43da61820013dfe8a2",
                                    "content": [
                                        "Pratiquer une bonne collecte des déchets réduit votre exposition à la pollution de l’air.",
                                        "Les sites centraux d'élimination des déchets peuvent servir de plaques tournantes pour les installations de recyclage et de tri."
                                    ],
                                    "title": "Recueillir dans une déchetterie",
                                    "createdAt": "2023-08-24T20:19:15.378Z",
                                    "updatedAt": "2023-08-24T20:20:40.759Z",
                                    "__v": 0,
                                    "kya_question": "64e712159953c100130e5663"
                                },
                                {
                                    "_id": "64f6cff5846746001a476e15",
                                    "content": [
                                        "Compostage – Les matières organiques telles que les restes de nourriture et les déchets de jardin sont séparées et enfouies sous le sol pour se décomposer et former du fumier végétal.",
                                        "Récupération – Les matériaux tels que le métal, le papier, le verre, les chiffons et certains types de plastique peuvent être récupérés, recyclés et réutilisés."
                                    ],
                                    "title": "J'aimerais connaître d'autres formes de gestion des déchets",
                                    "createdAt": "2023-09-05T06:51:33.827Z",
                                    "updatedAt": "2023-09-05T06:52:04.320Z",
                                    "__v": 0,
                                    "kya_question": "64e712159953c100130e5663"
                                }
                            ]
                        },
                        {
                            "_id": "64e70c3648456f0012137660",
                            "title": "Où se situe votre environnement domestique ?",
                            "context": "Environnement de la maison",
                            "question_position": 3,
                            "createdAt": "2023-08-24T07:52:22.641Z",
                            "updatedAt": "2023-09-05T06:59:04.319Z",
                            "__v": 0,
                            "kya_quiz": "64e722d048456f0012137aee",
                            "answers": [
                                {
                                    "_id": "64e7b121da61820013dfe458",
                                    "content": [
                                        "Vivre à proximité d’une route très fréquentée augmente l’exposition à la pollution atmosphérique.",
                                        "N'ouvrez les fenêtres donnant sur la route que lorsque la circulation est faible.",
                                        "Plantez des arbres/haies autour de la maison comme barrière contre les émissions."
                                    ],
                                    "title": "À côté d'une route très fréquentée",
                                    "createdAt": "2023-08-24T19:36:02.002Z",
                                    "updatedAt": "2023-08-24T20:11:43.493Z",
                                    "__v": 0,
                                    "kya_question": "64e70c3648456f0012137660"
                                },
                                {
                                    "_id": "64e7b146da61820013dfe45c",
                                    "content": [
                                        "Votre exposition à la pollution atmosphérique est limitée puisqu’il y a moins d’émissions de véhicules."
                                    ],
                                    "title": "Rue peu ou pas de circulation",
                                    "createdAt": "2023-08-24T19:36:38.369Z",
                                    "updatedAt": "2023-09-13T07:57:14.005Z",
                                    "__v": 0,
                                    "kya_question": "64e70c3648456f0012137660"
                                }
                            ]
                        },
                        {
                            "_id": "64e722a748456f0012137aea",
                            "title": "À quelle fréquence participez-vous à des activités de plein air ?",
                            "context": "Activités extérieures",
                            "question_position": 4,
                            "createdAt": "2023-08-24T09:28:07.216Z",
                            "updatedAt": "2023-09-05T07:02:46.705Z",
                            "__v": 0,
                            "kya_quiz": "64e722d048456f0012137aee",
                            "answers": [
                                {
                                    "_id": "64e7b1a1da61820013dfe461",
                                    "content": [
                                        "Gardez une trace de la qualité actuelle de l'air et des prévisions dans votre emplacement via l'application AirQo pour éviter les activités de plein air les jours de mauvaise qualité de l'air.",
                                        "Horaires à faible pollution comme tôt le matin ou tard le soir.",
                                        "Planifiez vos activités autour des routes moins fréquentées et des espaces verts."
                                    ],
                                    "title": "Régulièrement",
                                    "createdAt": "2023-08-24T19:38:09.278Z",
                                    "updatedAt": "2023-08-24T20:31:34.636Z",
                                    "__v": 0,
                                    "kya_question": "64e722a748456f0012137aea"
                                },
                                {
                                    "_id": "64e7b1e9da61820013dfe465",
                                    "content": [
                                        "Vérifiez la qualité de l'air et les prévisions dans votre emplacement via l'application AirQo pour éviter les activités de plein air les jours de mauvaise qualité de l'air.",
                                        "Limitez la durée des activités de plein air les jours où la qualité de l’air est mauvaise."
                                    ],
                                    "title": "Occasionnellement",
                                    "createdAt": "2023-08-24T19:39:21.697Z",
                                    "updatedAt": "2023-08-24T20:31:34.636Z",
                                    "__v": 0,
                                    "kya_question": "64e722a748456f0012137aea"
                                },
                                {
                                    "_id": "64e7b20fda61820013dfe46a",
                                    "content": [
                                        "Pour les personnes qui ne participent pas à des activités de plein air, envisagez des options d'exercices en salle, comme utiliser un tapis roulant, un vélo stationnaire ou suivre des cours de fitness.",
                                        "Utilisez l'application AirQo pour vérifier la qualité de l'air et les prévisions dans votre emplacement afin de planifier à l'avance toute activité de plein air.",
                                        "Pensez à minimiser votre exposition à la pollution de l’air à la maison en évitant de brûler les déchets à l’air libre et en augmentant la ventilation de la maison lorsque vous pratiquez des activités génératrices de polluants."
                                    ],
                                    "title": "Rarement/Jamais",
                                    "createdAt": "2023-08-24T19:39:59.067Z",
                                    "updatedAt": "2023-09-13T07:58:56.770Z",
                                    "__v": 0,
                                    "kya_question": "64e722a748456f0012137aea"
                                }
                            ]
                        },
                        {
                            "_id": "64e711ac9953c100130e565e",
                            "title": "Quel type de route utilisez-vous fréquemment ?",
                            "context": "Transport",
                            "question_position": 5,
                            "createdAt": "2023-08-24T08:15:40.227Z",
                            "updatedAt": "2023-09-05T07:00:01.853Z",
                            "__v": 0,
                            "kya_quiz": "64e722d048456f0012137aee",
                            "answers": [
                                {
                                    "_id": "64e7b230da61820013dfe470",
                                    "content": [
                                        "Fermez les fenêtres et les portes par temps poussiéreux, surtout par temps venteux.",
                                        "Portez un masque ou couvrez votre nez/bouche avec un chiffon comme un mouchoir/écharpe lorsqu'il y a de la poussière.",
                                        "N'oubliez pas de vérifier la qualité de l'air et les prévisions dans votre région via l'application AirQo pour planifier à l'avance les jours de mauvaise qualité de l'air."
                                    ],
                                    "title": "Une route poussiéreuse/non pavée",
                                    "createdAt": "2023-08-24T19:40:32.526Z",
                                    "updatedAt": "2023-09-13T08:00:15.841Z",
                                    "__v": 0,
                                    "kya_question": "64e711ac9953c100130e565e"
                                },
                                {
                                    "_id": "64e7b250da61820013dfe474",
                                    "content": [
                                        "Vivre à côté de routes goudronnées vous expose à moins de poussière, mais les émissions des véhicules peuvent toujours avoir un impact sur la qualité de l'air.",
                                        "Plantez des arbres/arbustes autour de votre maison comme barrières naturelles pour absorber les polluants."
                                    ],
                                    "title": "Route goudronnée/route avec moins de poussière",
                                    "createdAt": "2023-08-24T19:41:04.666Z",
                                    "updatedAt": "2023-08-24T20:27:09.659Z",
                                    "__v": 0,
                                    "kya_question": "64e711ac9953c100130e565e"
                                }
                            ]
                        },
                        {
                            "_id": "64e714d04c07320013b6ed25",
                            "title": "Quel est votre mode de transport le plus utilisé ?",
                            "context": "Transport",
                            "question_position": 6,
                            "createdAt": "2023-08-24T08:29:04.922Z",
                            "updatedAt": "2023-09-05T07:02:12.284Z",
                            "__v": 0,
                            "kya_quiz": "64e722d048456f0012137aee",
                            "answers": [
                                {
                                    "_id": "64e7b2b0da61820013dfe479",
                                    "content": [
                                        "Entretenez régulièrement votre voiture pour garantir un moteur sain qui réduit les émissions.",
                                        "Évitez d'attendre longtemps avec le moteur de la voiture en marche.",
                                        "Lorsque cela est possible, faites du covoiturage avec d’autres personnes pour réduire le nombre de voitures sur la route."
                                    ],
                                    "title": "Une voiture",
                                    "createdAt": "2023-08-24T19:42:40.992Z",
                                    "updatedAt": "2023-08-24T20:28:39.058Z",
                                    "__v": 0,
                                    "kya_question": "64e714d04c07320013b6ed25"
                                },
                                {
                                    "_id": "64e7b2c4da61820013dfe47d",
                                    "content": [
                                        "L'utilisation des transports en commun tend à réduire le nombre total de véhicules sur la route. Cela réduit les émissions des véhicules et l’exposition à la pollution atmosphérique."
                                    ],
                                    "title": "Taxi ou bus",
                                    "createdAt": "2023-08-24T19:43:00.072Z",
                                    "updatedAt": "2023-08-24T20:28:39.058Z",
                                    "__v": 0,
                                    "kya_question": "64e714d04c07320013b6ed25"
                                },
                                {
                                    "_id": "64e7b30ada61820013dfe482",
                                    "content": [
                                        "Lorsque vous utilisez un boda boda, portez un masque pour vous protéger de l'inhalation de poussière et de polluants.",
                                        "Les conducteurs de Boda Boda sont encouragés à effectuer un entretien approprié du moteur."
                                    ],
                                    "title": "Mariage mariage / moto",
                                    "createdAt": "2023-08-24T19:44:10.746Z",
                                    "updatedAt": "2023-08-24T20:28:39.058Z",
                                    "__v": 0,
                                    "kya_question": "64e714d04c07320013b6ed25"
                                },
                                {
                                    "_id": "64e7b324da61820013dfe486",
                                    "content": [
                                        "Marchez sur des trottoirs plus éloignés des routes, car cela contribuera à réduire l’exposition aux émissions des véhicules.",
                                        "Avant de partir, vérifiez la qualité de l'air dans votre région via l'application AirQo. Envisagez de prendre des transports alternatifs ou d’utiliser des itinéraires alternatifs si la qualité de l’air est mauvaise.",
                                        "Portez un masque si vous marchez pendant les heures de forte pollution comme tôt le matin (de 7h à 10h) et tard le soir lorsque la circulation est plus dense.",
                                        "Si possible, choisissez des itinéraires qui évitent les zones présentant des sources connues de pollution, comme les chantiers de construction ou les zones industrielles."
                                    ],
                                    "title": "Marche",
                                    "createdAt": "2023-08-24T19:44:37.006Z",
                                    "updatedAt": "2023-09-13T09:28:39.914Z",
                                    "__v": 0,
                                    "kya_question": "64e714d04c07320013b6ed25"
                                }
                            ]
                        }
                    ]
                }
            ];

            // const translatedQuizzes = [];
            // for (const quiz of quizzes) {
            //     const translatedQuiz = { ...quiz };
            //     translatedQuiz.title = await translateText(quiz.title, targetLanguage);
            //     translatedQuiz.description = await translateText(quiz.description, targetLanguage);
            //     translatedQuiz.completion_message = await translateText(quiz.completion_message, targetLanguage);
            //     const translatedQuestions = [];
            //     for (const question of quiz.questions) {
            //         const translatedQuestion = { ...question };
            //         translatedQuestion.title = await translateText(question.title, targetLanguage);
            //         translatedQuestion.context = await translateText(question.context, targetLanguage);
            //         const translatedAnswers = [];
            //         for (const answer of question.answers) {
            //             const translatedAnswer = { ...answer };
            //             translatedAnswer.title = await translateText(answer.title, targetLanguage);
            //             const translatedContent = [];
            //             for (const contentItem of answer.content) {
            //                 const translatedItem = await translateText(contentItem, targetLanguage);
            //                 translatedContent.push(translatedItem);
            //             }
            //             translatedAnswer.content = translatedContent;

            //             translatedAnswers.push(translatedAnswer);
            //         }
            //         translatedQuestion.answers = translatedAnswers;
            //         translatedQuestions.push(translatedQuestion);
            //     }
            //     translatedQuiz.questions = translatedQuestions
            //     translatedQuizzes.push(translatedQuiz);
            // }

            return {
                success: true,
                message: "Translated KYA returned Successfully",
                data: translatedQuizzes,
                status: httpStatus.OK,
            };
        } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
            return {
                success: false,
                message: "Internal Server Error",
                status: httpStatus.INTERNAL_SERVER_ERROR,
                errors: {
                    message: error.message,
                },
            };
        }
    },


};

async function translateText(text, target) {
    try {
        const translations = await translate.translate(text, target);
        if (translations && Array.isArray(translations)) {
            return translations[0];
        } else {
            return translations;
        }
    } catch (error) {
        logger.error(`internal server error -- ${error.message}`);
        throw error;
    }
}

module.exports = translateUtil;