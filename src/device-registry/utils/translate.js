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

            const translatedHealthTips = [];

            let index = 0;
            for (const healthTip of healthTips) {
                const translatedTip = { ...healthTip };
                const translations = await tipsTranslations(index, targetLanguage);
                translatedTip.title = translations.title;
                translatedTip.description = translations.description;
                translatedHealthTips.push(translatedTip);
                index++;
            }

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
            const translatedLessons = [];

            let index = 0;
            for (const lesson of lessons) {
                const translatedLesson = { ...lesson };
                const translation = await lessonTranslations(index, targetLanguage);
                translatedLesson.title = translation.title;
                translatedLesson.completion_message = translation.completion_message;
                const translatedTasks = [];
                let taskIndex = 0;
                for (const task of lesson.tasks) {
                    const translatedTask = { ...task };
                    translatedTask.title = (translation.tasks[taskIndex]).title;
                    translatedTask.content = (translation.tasks[taskIndex]).content;
                    translatedTasks.push(translatedTask);
                    taskIndex++;
                }
                translatedLesson.tasks = translatedTasks
                translatedLessons.push(translatedLesson);
                index++;
            }

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
            const translatedQuizzes = [];

            let index = 0;
            for (const quiz of quizzes) {
                const translatedQuiz = { ...quiz };
                const translation = await quizTranslations(index, targetLanguage)
                translatedQuiz.title = translation.title;
                translatedQuiz.description = translation.description;
                translatedQuiz.completion_message = translation.completion_message;

                const translatedQuestions = [];
                let questionIndex = 0;
                for (const question of quiz.questions) {
                    const translatedQuestion = { ...question };
                    const targetQuestion = translation.questions[questionIndex]
                    translatedQuestion.title = targetQuestion.title;
                    translatedQuestion.context = targetQuestion.context;

                    const translatedAnswers = [];
                    let answerIndex = 0;
                    for (const answer of question.answers) {
                        const translatedAnswer = { ...answer };
                        const targetAnswer = targetQuestion.answers[answerIndex]
                        translatedAnswer.title = targetAnswer.title;
                        translatedAnswer.content = targetAnswer.content;

                        translatedAnswers.push(translatedAnswer);
                        answerIndex++;
                    }
                    translatedQuestion.answers = translatedAnswers;
                    translatedQuestions.push(translatedQuestion);
                    questionIndex++;
                }
                translatedQuiz.questions = translatedQuestions
                translatedQuizzes.push(translatedQuiz);
                index++;
            }

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

async function tipsTranslations(index, target) {
    switch (target) {
        case "fr":
            const frenchTips = [
                {
                    "title": "Pour tout le monde",
                    "description": "Si vous devez passer beaucoup de temps dehors, les masques jetables comme le N95 sont utiles.",
                },
                {
                    "title": "Pour tout le monde",
                    "description": "Réduisez l’intensité de vos activités de plein air. Essayez de rester à l’intérieur jusqu’à ce que la qualité de l’air s’améliore.",
                },
                {
                    "title": "Pour tout le monde",
                    "description": "Évitez les activités qui vous font respirer plus rapidement. Aujourd’hui est le jour idéal pour passer une lecture à l’intérieur.",
                },
                {
                    "title": "Pour les enfants",
                    "description": "Réduisez l’intensité de vos activités de plein air.",
                },
                {
                    "title": "Pour les personnes âgées",
                    "description": "Réduisez l’intensité de vos activités de plein air.",
                },
                {
                    "title": "Pour les femmes enceintes",
                    "description": "Réduisez l’intensité de vos activités de plein air pour rester en bonne santé, vous et votre bébé.",
                },
                {
                    "title": "Pour les personnes ayant des problèmes respiratoires",
                    "description": "Réduisez les exercices intenses. Allez-y doucement si vous ressentez des signes comme la toux.",
                },
                {
                    "title": "Pour les personnes âgées",
                    "description": "Réduisez l’intensité de vos activités de plein air.",
                },
                {
                    "title": "Pour les femmes enceintes",
                    "description": "Réduisez l’intensité de vos activités de plein air pour rester en bonne santé, vous et votre bébé.",
                },
                {
                    "title": "Pour tout le monde",
                    "description": "Aujourd'hui est une journée idéale pour les activités de plein air.",
                },
                {
                    "title": "Pour tout le monde",
                    "description": "C'est une excellente journée pour sortir et faire de l'exercice. Pensez à réduire le nombre de déplacements en voiture que vous effectuez.",
                },
            ];
            return frenchTips[index];
            break;

    }

}

async function lessonTranslations(index, target) {
    switch (target) {
        case "fr":
            const frenchLessons = [
                {
                    "title": "Mesures que vous pouvez prendre pour réduire la pollution de l’air",
                    "completion_message": "Vous venez de terminer votre première leçon Know Your Air.",
                    "tasks": [
                        {
                            "title": "Utilisez les transports en commun",
                            "content": "Les gaz d’échappement des véhicules constituent une source majeure de pollution atmosphérique. Moins de voitures sur la route entraîne moins d’émissions.",
                        },
                        {
                            "title": "Entretenez régulièrement votre voiture/boda boda",
                            "content": "Des inspections régulières peuvent maximiser le rendement énergétique, ce qui réduit les émissions des véhicules.",
                        },
                        {
                            "title": "Évitez de faire tourner le moteur de votre voiture au ralenti dans la circulation",
                            "content": "Les véhicules produisent des gaz d’échappement particulièrement malsains. Éteignez votre moteur dans la circulation",
                        },
                        {
                            "title": "Marcher ou faire du vélo",
                            "content": "Marchez ou faites du vélo pour réduire votre empreinte carbone individuelle tout en améliorant votre santé !",
                        },
                        {
                            "title": "Évitez de brûler les déchets",
                            "content": "Brûler vos déchets ménagers est dangereux pour votre santé et notre environnement",
                        },
                        {
                            "title": "Réduisez les produits en plastique à usage unique",
                            "content": "Évitez d'utiliser des sacs en plastique, ils mettent plus de temps à se décomposer. Utilisez des sacs ou des paniers en papier pour vos courses",
                        },
                        {
                            "title": "Devenez un champion de l’air pur",
                            "content": "Rejoignez notre campagne sur la qualité de l'air et plaidez pour un air pur dans votre communauté.",
                        },
                    ],
                },
            ];

            return frenchLessons[index];
            break;

    }

}

async function quizTranslations(index, target) {
    switch (target) {
        case "fr":
            const frenchQuizzes = [
                {
                    "title": "Découvrez ici vos conseils personnalisés sur la qualité de l’air !",
                    "description": "Répondez à ce quiz sur votre environnement et votre routine quotidienne pour débloquer des conseils personnalisés rien que pour vous !",
                    "completion_message": "Marche à suivre. Vous avez débloqué des recommandations personnalisées sur la qualité de l'air pour vous aider dans votre voyage vers un air pur.",
                    "questions": [
                        {
                            "title": "Quelle méthode de cuisson utilisez-vous à la maison ?",
                            "context": "Environnement de la maison",
                            "answers": [
                                {
                                    "content": [
                                        "Cuisiner avec du bois de chauffage peut émettre des quantités importantes de polluants atmosphériques.",
                                        "Cuisinez dans une cuisine bien ventilée avec une bonne circulation d’air ou installez une cuisine extérieure si possible.",
                                        "Utilisez un poêle efficace conçu pour brûler du bois de chauffage plus proprement et avec moins de fumée.",
                                        "Envisagez de passer à des cuisinières améliorées qui réduisent les émissions et augmentent le rendement énergétique."
                                    ],
                                    "title": "Bois de chauffage",
                                },
                                {
                                    "content": [
                                        "L’utilisation d’un poêle à charbon pour cuisiner peut libérer des polluants nocifs comme des particules et du monoxyde de carbone.",
                                        "Utilisez un poêle à charbon dans une cuisine bien ventilée ou près d'une fenêtre ouverte.",
                                        "Pendant la cuisson, gardez les portes et les fenêtres ouvertes pour réduire la fumée.",
                                        "Si possible, envisagez de passer à des options de cuisson plus propres pour réduire la pollution de l’air intérieur."
                                    ],
                                    "title": "Poêle à charbon",
                                },
                                {
                                    "content": [
                                        "L’utilisation d’une cuisinière à gaz est généralement une option plus propre que les combustibles solides.",
                                        "Assurer une ventilation adéquate pour éviter l’accumulation d’émissions de gaz à l’intérieur.",
                                        "Entretenir les cuisinières à gaz et les branchements pour éviter les fuites qui pourraient nuire à la qualité de l’air intérieur."
                                    ],
                                    "title": "Cuisinière à gaz",
                                },
                                {
                                    "content": [
                                        "Le biogaz est considéré comme une option de cuisson plus propre.",
                                        "Entretenez régulièrement le système de biogaz pour assurer une production et une combustion efficaces du gaz.",
                                        "Bien que le biogaz soit plus propre, assurez une ventilation adéquate pour éviter toute émission persistante.",
                                        "Suivez les directives du fabricant pour une utilisation sûre et efficace du biogaz."
                                    ],
                                    "title": "Biogaz",
                                },
                                {
                                    "content": [
                                        "Les cuisinières électriques ne produisent aucun polluant direct dans l’air intérieur.",
                                        "Même sans émissions, assurez une ventilation adéquate pour éviter d’autres polluants de l’air intérieur.",
                                        "L’utilisation de cuisinières électriques économes en énergie peut réduire l’impact environnemental global."
                                    ],
                                    "title": "Cuisinière électrique",
                                }
                            ]
                        },
                        {
                            "title": "Comment éliminer les déchets à la maison ?",
                            "context": "Environnement de la maison",
                            "answers": [
                                {
                                    "_id": "64e7652e1fb90d0013a707fe",
                                    "content": [
                                        "Le brûlage des déchets peut libérer divers polluants comme des particules et des substances toxiques.",
                                        "Assurez-vous d'utiliser des méthodes appropriées d'élimination des déchets comme le recyclage, la collecte dans une déchetterie ou le recours à des entreprises de services de collecte des déchets."
                                    ],
                                    "title": "Brûle le",

                                },
                                {
                                    "content": [
                                        "Pratiquer une bonne collecte des déchets réduit votre exposition à la pollution de l’air.",
                                        "Les sites centraux d'élimination des déchets peuvent servir de plaques tournantes pour les installations de recyclage et de tri."
                                    ],
                                    "title": "Recueillir dans une déchetterie",
                                },
                                {
                                    "content": [
                                        "Compostage – Les matières organiques telles que les restes de nourriture et les déchets de jardin sont séparées et enfouies sous le sol pour se décomposer et former du fumier végétal.",
                                        "Récupération – Les matériaux tels que le métal, le papier, le verre, les chiffons et certains types de plastique peuvent être récupérés, recyclés et réutilisés."
                                    ],
                                    "title": "J'aimerais connaître d'autres formes de gestion des déchets",

                                }
                            ]
                        },
                        {
                            "title": "Où se situe votre environnement domestique ?",
                            "context": "Environnement de la maison",

                            "answers": [
                                {
                                    "content": [
                                        "Vivre à proximité d’une route très fréquentée augmente l’exposition à la pollution atmosphérique.",
                                        "N'ouvrez les fenêtres donnant sur la route que lorsque la circulation est faible.",
                                        "Plantez des arbres/haies autour de la maison comme barrière contre les émissions."
                                    ],
                                    "title": "À côté d'une route très fréquentée",

                                },
                                {
                                    "content": [
                                        "Votre exposition à la pollution atmosphérique est limitée puisqu’il y a moins d’émissions de véhicules."
                                    ],
                                    "title": "Rue peu ou pas de circulation",
                                }
                            ]
                        },
                        {
                            "title": "À quelle fréquence participez-vous à des activités de plein air ?",
                            "context": "Activités extérieures",


                            "answers": [
                                {
                                    "content": [
                                        "Gardez une trace de la qualité actuelle de l'air et des prévisions dans votre emplacement via l'application AirQo pour éviter les activités de plein air les jours de mauvaise qualité de l'air.",
                                        "Horaires à faible pollution comme tôt le matin ou tard le soir.",
                                        "Planifiez vos activités autour des routes moins fréquentées et des espaces verts."
                                    ],
                                    "title": "Régulièrement",


                                },
                                {
                                    "content": [
                                        "Vérifiez la qualité de l'air et les prévisions dans votre emplacement via l'application AirQo pour éviter les activités de plein air les jours de mauvaise qualité de l'air.",
                                        "Limitez la durée des activités de plein air les jours où la qualité de l’air est mauvaise."
                                    ],
                                    "title": "Occasionnellement",


                                },
                                {
                                    "content": [
                                        "Pour les personnes qui ne participent pas à des activités de plein air, envisagez des options d'exercices en salle, comme utiliser un tapis roulant, un vélo stationnaire ou suivre des cours de fitness.",
                                        "Utilisez l'application AirQo pour vérifier la qualité de l'air et les prévisions dans votre emplacement afin de planifier à l'avance toute activité de plein air.",
                                        "Pensez à minimiser votre exposition à la pollution de l’air à la maison en évitant de brûler les déchets à l’air libre et en augmentant la ventilation de la maison lorsque vous pratiquez des activités génératrices de polluants."
                                    ],
                                    "title": "Rarement/Jamais",
                                }
                            ]
                        },
                        {
                            "title": "Quel type de route utilisez-vous fréquemment ?",
                            "context": "Transport",

                            "answers": [
                                {
                                    "content": [
                                        "Fermez les fenêtres et les portes par temps poussiéreux, surtout par temps venteux.",
                                        "Portez un masque ou couvrez votre nez/bouche avec un chiffon comme un mouchoir/écharpe lorsqu'il y a de la poussière.",
                                        "N'oubliez pas de vérifier la qualité de l'air et les prévisions dans votre région via l'application AirQo pour planifier à l'avance les jours de mauvaise qualité de l'air."
                                    ],
                                    "title": "Une route poussiéreuse/non pavée",

                                },
                                {
                                    "content": [
                                        "Vivre à côté de routes goudronnées vous expose à moins de poussière, mais les émissions des véhicules peuvent toujours avoir un impact sur la qualité de l'air.",
                                        "Plantez des arbres/arbustes autour de votre maison comme barrières naturelles pour absorber les polluants."
                                    ],
                                    "title": "Route goudronnée/route avec moins de poussière",
                                }
                            ]
                        },
                        {
                            "title": "Quel est votre mode de transport le plus utilisé ?",
                            "context": "Transport",
                            "answers": [
                                {
                                    "content": [
                                        "Entretenez régulièrement votre voiture pour garantir un moteur sain qui réduit les émissions.",
                                        "Évitez d'attendre longtemps avec le moteur de la voiture en marche.",
                                        "Lorsque cela est possible, faites du covoiturage avec d’autres personnes pour réduire le nombre de voitures sur la route."
                                    ],
                                    "title": "Une voiture",


                                },
                                {
                                    "content": [
                                        "L'utilisation des transports en commun tend à réduire le nombre total de véhicules sur la route. Cela réduit les émissions des véhicules et l’exposition à la pollution atmosphérique."
                                    ],
                                    "title": "Taxi ou bus",
                                },
                                {
                                    "content": [
                                        "Lorsque vous utilisez un boda boda, portez un masque pour vous protéger de l'inhalation de poussière et de polluants.",
                                        "Les conducteurs de Boda Boda sont encouragés à effectuer un entretien approprié du moteur."
                                    ],
                                    "title": "Mariage mariage / moto",
                                },
                                {
                                    "content": [
                                        "Marchez sur des trottoirs plus éloignés des routes, car cela contribuera à réduire l’exposition aux émissions des véhicules.",
                                        "Avant de partir, vérifiez la qualité de l'air dans votre région via l'application AirQo. Envisagez de prendre des transports alternatifs ou d’utiliser des itinéraires alternatifs si la qualité de l’air est mauvaise.",
                                        "Portez un masque si vous marchez pendant les heures de forte pollution comme tôt le matin (de 7h à 10h) et tard le soir lorsque la circulation est plus dense.",
                                        "Si possible, choisissez des itinéraires qui évitent les zones présentant des sources connues de pollution, comme les chantiers de construction ou les zones industrielles."
                                    ],
                                    "title": "Marche",

                                }
                            ]
                        }
                    ]
                }
            ];

            return frenchQuizzes[index];
            break;

    }

}



module.exports = translateUtil;