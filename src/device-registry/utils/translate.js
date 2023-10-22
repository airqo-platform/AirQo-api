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
    let translatedTips = [];
    switch (target) {
        case "fr":
            translatedTips = [
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
            break;
        case "pt":
            translatedTips = [
                {
                    "title": "Para todos",
                    "description": "Se você precisa passar muito tempo ao ar livre, máscaras descartáveis como a N95 são úteis."
                },
                {
                    "title": "Para todos",
                    "description": "Reduza a intensidade de suas atividades ao ar livre. Tente ficar dentro de casa até que a qualidade do ar melhore."
                },
                {
                    "title": "Para todos",
                    "description": "Evite atividades que o façam respirar mais rapidamente. Hoje é o dia ideal para passar o tempo lendo em ambientes fechados."
                },
                {
                    "title": "Para crianças",
                    "description": "Reduza a intensidade de suas atividades ao ar livre."
                },
                {
                    "title": "Para idosos",
                    "description": "Reduza a intensidade de suas atividades ao ar livre."
                },
                {
                    "title": "Para mulheres grávidas",
                    "description": "Reduza a intensidade de suas atividades ao ar livre para manter a saúde, sua e a do seu bebê."
                },
                {
                    "title": "Para pessoas com problemas respiratórios",
                    "description": "Reduza os exercícios intensos. Vá devagar se você sentir sinais como tosse."
                },
                {
                    "title": "Para idosos",
                    "description": "Reduza a intensidade de suas atividades ao ar livre."
                },
                {
                    "title": "Para mulheres grávidas",
                    "description": "Reduza a intensidade de suas atividades ao ar livre para manter a saúde, sua e a do seu bebê."
                },
                {
                    "title": "Para todos",
                    "description": "Hoje é um dia ideal para atividades ao ar livre."
                },
                {
                    "title": "Para todos",
                    "description": "É um ótimo dia para sair e se exercitar. Considere reduzir a quantidade de viagens de carro que você faz."
                }
            ];
            break;
        case "sw":
            translatedTips = [
                {
                    "title": "Kwa Kila Mtu",
                    "description": "Ikiwa unapaswa kutumia muda mwingi nje, barakoa za kutupa kama N95 ni muhimu."
                },
                {
                    "title": "Kwa Kila Mtu",
                    "description": "Punguza ukali wa shughuli zako za nje. Jaribu kukaa ndani hadi ubora wa hewa unapoboresha."
                },
                {
                    "title": "Kwa Kila Mtu",
                    "description": "Epuka shughuli zinazokufanya upumue haraka zaidi. Leo ni siku nzuri kwa kusoma ndani ya nyumba."
                },
                {
                    "title": "Kwa Watoto",
                    "description": "Punguza ukali wa shughuli zako za nje."
                },
                {
                    "title": "Kwa Wazee",
                    "description": "Punguza ukali wa shughuli zako za nje."
                },
                {
                    "title": "Kwa Wanawake Wajawazito",
                    "description": "Punguza ukali wa shughuli zako za nje ili kudumisha afya yako na ya mtoto wako."
                },
                {
                    "title": "Kwa Watu Wenye Matatizo ya Upumuaji",
                    "description": "Punguza mazoezi makali. Endelea polepole ikiwa unaona dalili kama vile kikohozi."
                },
                {
                    "title": "Kwa Wazee",
                    "description": "Punguza ukali wa shughuli zako za nje."
                },
                {
                    "title": "Kwa Wanawake Wajawazito",
                    "description": "Punguza ukali wa shughuli zako za nje ili kudumisha afya yako na ya mtoto wako."
                },
                {
                    "title": "Kwa Kila Mtu",
                    "description": "Leo ni siku nzuri kwa shughuli za nje."
                },
                {
                    "title": "Kwa Kila Mtu",
                    "description": "Ni siku nzuri kwa kutoka nje na kufanya mazoezi. Fikiria kupunguza idadi ya safari za gari unazofanya."
                }
            ];
            break;

    }
    return translatedTips[index];

}

async function lessonTranslations(index, target) {
    let translatedLessons = [];
    switch (target) {
        case "fr":
            translatedLessons = [
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
            break;
        case "pt":
            translatedLessons = [
                {
                    "title": "Medidas que você pode tomar para reduzir a poluição do ar",
                    "completion_message": "Você acabou de concluir sua primeira lição Know Your Air.",
                    "tasks": [
                        {
                            "title": "Use o transporte público",
                            "content": "Os gases de escape dos veículos são uma grande fonte de poluição do ar. Menos carros na estrada significam menos emissões.",
                        },
                        {
                            "title": "Faça manutenção regular do seu carro/boda boda",
                            "content": "Inspeções regulares podem maximizar a eficiência energética, reduzindo as emissões dos veículos.",
                        },
                        {
                            "title": "Evite deixar o motor do seu carro ligado em marcha lenta no trânsito",
                            "content": "Os veículos produzem gases de escape particularmente prejudiciais. Desligue o motor no trânsito.",
                        },
                        {
                            "title": "Caminhe ou ande de bicicleta",
                            "content": "Caminhar ou andar de bicicleta ajuda a reduzir sua pegada de carbono individual e melhora sua saúde!",
                        },
                        {
                            "title": "Evite queimar lixo",
                            "content": "Queimar lixo doméstico é prejudicial para a sua saúde e para o nosso meio ambiente.",
                        },
                        {
                            "title": "Reduza produtos de plástico descartáveis",
                            "content": "Evite usar sacolas plásticas, pois demoram mais para se decompor. Use sacolas de papel ou cestas para suas compras.",
                        },
                        {
                            "title": "Se torne um defensor do ar puro",
                            "content": "Junte-se à nossa campanha pela qualidade do ar e defenda um ar puro em sua comunidade.",
                        },
                    ],
                },
            ];
            break;
        case "sw":
            translatedLessons = [
                {
                    "title": "Hatua Unazoweza Kuchukua Kupunguza Uchafuzi wa Hewa",
                    "completion_message": "Umeanza somo lako la kwanza la Kujua Hewa Yako.",
                    "tasks": [
                        {
                            "title": "Tumia Usafiri wa Umma",
                            "content": "Moshi wa magari ni chanzo kikubwa cha uchafuzi wa hewa. Idadi ndogo ya magari barabarani inamaanisha uzalishaji mdogo wa gesi chafu.",
                        },
                        {
                            "title": "Hudumia Mara Kwa Mara Gari/Boda Boda Yako",
                            "content": "Uchunguzi wa mara kwa mara unaweza kuboresha utendaji wa nishati, na hivyo kupunguza uzalishaji wa magari.",
                        },
                        {
                            "title": "Epuka Kuzima Gari Lako kwenye Trafiki",
                            "content": "Magari hutoa moshi hatari sana. Zima injini yako unapokuwa kwenye msongamano wa trafiki.",
                        },
                        {
                            "title": "Tembea au Peda Baiskeli",
                            "content": "Tembea au piga baiskeli ili kupunguza alama yako ya kaboni binafsi na kuboresha afya yako!",
                        },
                        {
                            "title": "Epuka Kuchoma Taka",
                            "content": "Kuchoma taka za nyumbani ni hatari kwa afya yako na mazingira yetu.",
                        },
                        {
                            "title": "Punguza Matumizi ya Bidhaa za Plastiki za Kutupa",
                            "content": "Epuka kutumia mifuko ya plastiki, kwani huchukua muda mrefu kuvunja. Tumia mifuko au bakuli za karatasi kwa ununuzi wako.",
                        },
                        {
                            "title": "Jiunge na Mshirika wa Hewa Safi",
                            "content": "Shiriki kampeni yetu kuhusu ubora wa hewa na simama kwa ajili ya hewa safi katika jamii yako.",
                        },
                    ],
                },
            ];
            break;

    }
    return translatedLessons[index];

}

async function quizTranslations(index, target) {
    let translatedQuizzes = []; 
    switch (target) {
        case "fr":
            translatedQuizzes = [
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
            break;
        case "pt":
            translatedQuizzes = [
                {
                    "title": "Descubra aqui suas dicas personalizadas sobre a qualidade do ar!",
                    "description": "Responda a este questionário sobre o seu ambiente e rotina diária para desbloquear dicas personalizadas exclusivas para você!",
                    "completion_message": "Proceda. Você desbloqueou recomendações personalizadas sobre a qualidade do ar para ajudá-lo em sua jornada rumo ao ar puro.",
                    "questions": [
                        {
                            "title": "Que método de cozimento você utiliza em casa?",
                            "context": "Ambiente doméstico",
                            "answers": [
                                {
                                    "content": [
                                        "Cozinhar com lenha pode emitir quantidades significativas de poluentes atmosféricos.",
                                        "Cozinhe em uma cozinha bem ventilada com boa circulação de ar ou instale uma cozinha ao ar livre, se possível.",
                                        "Use um fogão eficiente projetado para queimar lenha de forma mais limpa e com menos fumaça.",
                                        "Considere a transição para fogões melhorados que reduzem as emissões e aumentam a eficiência energética."
                                    ],
                                    "title": "Lenha",
                                },
                                {
                                    "content": [
                                        "Usar um fogão a carvão para cozinhar pode liberar poluentes prejudiciais, como partículas e monóxido de carbono.",
                                        "Use um fogão a carvão em uma cozinha bem ventilada ou perto de uma janela aberta.",
                                        "Mantenha as portas e janelas abertas durante o cozimento para reduzir a fumaça.",
                                        "Se possível, considere opções de cozimento mais limpas para reduzir a poluição do ar interno."
                                    ],
                                    "title": "Fogão a carvão",
                                },
                                {
                                    "content": [
                                        "O uso de um fogão a gás é geralmente uma opção mais limpa do que os combustíveis sólidos.",
                                        "Garanta uma ventilação adequada para evitar o acúmulo de emissões de gás no interior.",
                                        "Mantenha os fogões a gás e as conexões para evitar vazamentos que possam prejudicar a qualidade do ar interno."
                                    ],
                                    "title": "Fogão a gás",
                                },
                                {
                                    "content": [
                                        "O biogás é considerado uma opção de cozimento mais limpa.",
                                        "Mantenha regularmente o sistema de biogás para garantir a produção e a queima eficaz do gás.",
                                        "Embora o biogás seja mais limpo, assegure uma ventilação adequada para evitar qualquer emissão contínua.",
                                        "Siga as diretrizes do fabricante para uso seguro e eficaz do biogás."
                                    ],
                                    "title": "Biogás",
                                },
                                {
                                    "content": [
                                        "Os fogões elétricos não emitem poluentes diretos no ar interno.",
                                        "Mesmo sem emissões, assegure uma ventilação adequada para evitar outros poluentes do ar interno.",
                                        "O uso de fogões elétricos eficientes em energia pode reduzir o impacto ambiental global."
                                    ],
                                    "title": "Fogão elétrico",
                                }
                            ]
                        },
                        {
                            "title": "Como você descarta resíduos em casa?",
                            "context": "Ambiente doméstico",
                            "answers": [
                                {
                                    "content": [
                                        "Queimar resíduos pode liberar vários poluentes, como partículas e substâncias tóxicas.",
                                        "Certifique-se de usar métodos apropriados de eliminação de resíduos, como reciclagem, descarte em um centro de coleta ou uso de empresas de serviços de coleta de resíduos."
                                    ],
                                    "title": "Queimar",
                                },
                                {
                                    "content": [
                                        "Praticar uma boa coleta de resíduos reduz sua exposição à poluição do ar.",
                                        "Os locais de descarte central podem servir como centros para instalações de reciclagem e triagem."
                                    ],
                                    "title": "Coletar em um centro de coleta",
                                },
                                {
                                    "content": [
                                        "Compostagem - Materiais orgânicos, como restos de comida e resíduos de jardim, são separados e enterrados no solo para decomposição e formação de adubo orgânico.",
                                        "Recuperação - Materiais como metal, papel, vidro, panos e alguns tipos de plástico podem ser recuperados, reciclados e reutilizados."
                                    ],
                                    "title": "Gostaria de saber sobre outras formas de gerenciamento de resíduos",
                                }
                            ]
                        },
                        {
                            "title": "Onde está localizado o seu ambiente doméstico?",
                            "context": "Ambiente doméstico",
                            "answers": [
                                {
                                    "content": [
                                        "Morar perto de uma estrada movimentada aumenta a exposição à poluição do ar.",
                                        "Abra as janelas voltadas para a estrada apenas quando o tráfego estiver fraco.",
                                        "Plante árvores/cercas ao redor da casa como barreira contra as emissões."
                                    ],
                                    "title": "Perto de uma estrada movimentada",
                                },
                                {
                                    "content": [
                                        "Sua exposição à poluição do ar é limitada, uma vez que há menos emissões de veículos."
                                    ],
                                    "title": "Rua com pouco ou nenhum tráfego",
                                }
                            ]
                        },
                        {
                            "title": "Com que frequência você participa de atividades ao ar livre?",
                            "context": "Atividades ao ar livre",
                            "answers": [
                                {
                                    "content": [
                                        "Acompanhe a qualidade do ar atual e as previsões em sua localização por meio do aplicativo AirQo para evitar atividades ao ar livre nos dias de má qualidade do ar.",
                                        "Horários com baixa poluição, como de manhã cedo ou à noite.",
                                        "Planeje suas atividades em torno de estradas menos movimentadas e áreas verdes."
                                    ],
                                    "title": "Regularmente",
                                },
                                {
                                    "content": [
                                        "Verifique a qualidade do ar e as previsões em sua localização por meio do aplicativo AirQo para evitar atividades ao ar livre nos dias de má qualidade do ar.",
                                        "Limite a duração das atividades ao ar livre nos dias em que a qualidade do ar estiver ruim."
                                    ],
                                    "title": "Ocasionalmente",
                                },
                                {
                                    "content": [
                                        "Para pessoas que não participam de atividades ao ar livre, considere opções de exercícios internos, como esteira, bicicleta ergométrica ou aulas de fitness.",
                                        "Use o aplicativo AirQo para verificar a qualidade do ar e as previsões em sua localização para planejar com antecedência qualquer atividade ao ar livre.",
                                        "Considere minimizar sua exposição à poluição do ar em casa, evitando queimar resíduos ao ar livre e aumentando a ventilação da casa durante atividades que geram poluentes."
                                    ],
                                    "title": "Raramente/Nunca",
                                }
                            ]
                        },
                        {
                            "title": "Que tipo de estrada você usa com frequência?",
                            "context": "Transporte",
                            "answers": [
                                {
                                    "content": [
                                        "Feche janelas e portas em dias empoeirados, especialmente em dias ventosos.",
                                        "Use uma máscara ou cubra o nariz/boca com um pano, como um lenço/cachecol, quando houver poeira.",
                                        "Lembre-se de verificar a qualidade do ar e as previsões em sua região por meio do aplicativo AirQo para planejar com antecedência em dias de má qualidade do ar."
                                    ],
                                    "title": "Uma estrada empoeirada/não pavimentada",
                                },
                                {
                                    "content": [
                                        "Morar perto de estradas asfaltadas expõe você a menos poeira, mas as emissões dos veículos ainda podem afetar a qualidade do ar.",
                                        "Plante árvores/arbustos ao redor de sua casa como barreiras naturais para absorver poluentes."
                                    ],
                                    "title": "Estrada asfaltada/estrada com menos poeira",
                                }
                            ]
                        },
                        {
                            "title": "Qual é o seu meio de transporte mais utilizado?",
                            "context": "Transporte",
                            "answers": [
                                {
                                    "content": [
                                        "Faça a manutenção regular do seu carro para garantir um motor saudável que reduz as emissões.",
                                        "Evite deixar o motor do carro ligado por muito tempo.",
                                        "Quando possível, faça caronas com outras pessoas para reduzir a quantidade de carros na estrada."
                                    ],
                                    "title": "Um carro",
                                },
                                {
                                    "content": [
                                        "O uso de transporte público tende a reduzir o número total de veículos na estrada. Isso reduz as emissões dos veículos e a exposição à poluição do ar."
                                    ],
                                    "title": "Táxi ou ônibus",
                                },
                                {
                                    "content": [
                                        "Ao usar uma motocicleta (boda boda), use uma máscara para se proteger da inalação de poeira e poluentes.",
                                        "Os condutores de boda boda são incentivados a realizar a manutenção adequada do motor."
                                    ],
                                    "title": "Motocicleta/moto",
                                },
                                {
                                    "content": [
                                        "Andar em calçadas mais afastadas das estradas ajudará a reduzir a exposição às emissões dos veículos.",
                                        "Antes de sair, verifique a qualidade do ar em sua região por meio do aplicativo AirQo. Considere usar meios de transporte alternativos ou rotas alternativas se a qualidade do ar estiver ruim.",
                                        "Use uma máscara se estiver andando durante os horários de alta poluição, como de manhã cedo (das 7h às 10h) e à noite, quando o tráfego está mais intenso.",
                                        "Se possível, escolha rotas que evitem áreas conhecidas por poluição, como locais de construção ou zonas industriais."
                                    ],
                                    "title": "A pé",
                                }
                            ]
                        }
                    ]
                }
            ];
            break;
        case "sw":
            translatedQuizzes = [
                {
                    "title": "Pata ushauri wako wa kibinafsi kuhusu ubora wa hewa hapa!",
                    "description": "Jibu mtihani huu kuhusu mazingira yako na ratiba yako ya kila siku ili kufungua ushauri wa kibinafsi uliotengenezwa mahsusi kwako!",
                    "completion_message": "Endelea. Umefungua mapendekezo ya kibinafsi kuhusu ubora wa hewa ili kusaidia safari yako kuelekea hewa safi.",
                    "questions": [
                        {
                            "title": "Unatumia njia gani ya kupika nyumbani?",
                            "context": "Mazingira ya nyumbani",
                            "answers": [
                                {
                                    "content": [
                                        "Kupika kwa kutumia kuni kunaweza kutoa kiwango kikubwa cha uchafuzi wa hewa.",
                                        "Pika katika jiko lenye uingizaji hewa mzuri au weka jiko nje ikiwa inawezekana.",
                                        "Tumia jiko lenye ufanisi lililobuniwa kuchoma kuni kwa usafi zaidi na bila moshi mwingi.",
                                        "Fikiria kubadilisha kwenye vifaa bora vya kupikia ambavyo hupunguza uzalishaji na kuongeza ufanisi wa nishati."
                                    ],
                                    "title": "Kuni",
                                },
                                {
                                    "content": [
                                        "Matumizi ya jiko la makaa ya mawe kwa kupikia kunaweza kutoa vichafuzi hatari kama vile chembe na kaboni monoksidi.",
                                        "Tumia jiko la makaa ya mawe katika jiko lenye uingizaji hewa mzuri au karibu na dirisha lililofunguliwa.",
                                        "Wakati wa kupikia, weka milango na madirisha wazi kupunguza moshi.",
                                        "Ikiwezekana, fikiria kuchagua njia safi za kupikia kupunguza uchafuzi wa hewa ndani."
                                    ],
                                    "title": "Jiko la makaa ya mawe",
                                },
                                {
                                    "content": [
                                        "Matumizi ya jiko la gesi kwa ujumla ni chaguo safi kuliko nishati za kuni.",
                                        "Hakikisha kuna uingizaji hewa wa kutosha ili kuepuka mkusanyiko wa gesi ndani ya nyumba.",
                                        "Tunza majiko ya gesi na viunganishi kuepuka uvujaji unaoweza kuharibu ubora wa hewa ndani."
                                    ],
                                    "title": "Jiko la gesi",
                                },
                                {
                                    "content": [
                                        "Biogesi inachukuliwa kuwa chaguo safi la kupikia.",
                                        "Tunza mara kwa mara mfumo wa biogesi ili kuhakikisha uzalishaji na uchomaji wa gesi unaofanyika kwa ufanisi.",
                                        "Ingawa biogesi ni safi, hakikisha kuna uingizaji hewa wa kutosha kuepuka uzalishaji wa mara kwa mara.",
                                        "Fuata mwongozo wa mtengenezaji kwa matumizi salama na ufanisi wa biogesi."
                                    ],
                                    "title": "Biogesi",
                                },
                                {
                                    "content": [
                                        "Majiko ya umeme hayatokezi uchafuzi moja kwa moja kwenye hewa ya ndani.",
                                        "Hata bila uzalishaji, hakikisha kuna uingizaji hewa wa kutosha ili kuepuka vichafuzi vingine katika hewa ya ndani.",
                                        "Matumizi ya majiko ya umeme yenye ufanisi wa nishati yanaweza kupunguza athari za mazingira kwa ujumla."
                                    ],
                                    "title": "Jiko la umeme",
                                }
                            ]
                        },
                        {
                            "title": "Unawezaje kushughulikia taka nyumbani?",
                            "context": "Mazingira ya nyumbani",
                            "answers": [
                                {
                                    "content": [
                                        "Kuchoma taka kunaweza kutoa vichafuzi mbalimbali kama vile chembe na vitu vyenye sumu.",
                                        "Hakikisha kutumia njia sahihi za kushughulikia taka kama vile kuchakata, kuchukua kwenye vituo vya taka au kutumia huduma za kukusanya taka."
                                    ],
                                    "title": "Kuchoma",
                                },
                                {
                                    "content": [
                                        "Kuwa na mfumo mzuri wa ukusanyaji wa taka kunapunguza mfiduo wako kwa uchafuzi wa hewa.",
                                        "Vituo vya kuuza taka vinaweza kutumika kama vituo vya kupokea na kusafirisha kwa ajili ya kuchakata na kusafisha vitu."
                                    ],
                                    "title": "Kukusanya kwenye kituo cha taka",
                                },
                                {
                                    "content": [
                                        "Kuoza - Vitu kama vile vyakula vya kikaboni na taka za bustani hukusanywa na kuzikwa chini ya ardhi ili kuoza na kutoa mbolea.",
                                        "Kurekebisha - Vitu kama vile metali, karatasi, kioo, nguo, na baadhi ya aina za plastiki zinaweza kurejeshwa, kuchakatwa na kutumika tena."
                                    ],
                                    "title": "Ningependa kujua njia nyingine za kushughulikia taka",
                                }
                            ]
                        },
                        {
                            "title": "Mazingira yako ya nyumbani iko wapi?",
                            "context": "Mazingira ya nyumbani",
                            "answers": [
                                {
                                    "content": [
                                        "Kuishi karibu na barabara yenye shughuli nyingi huongeza mfiduo kwa uchafuzi wa hewa.",
                                        "Fungua madirisha yanayoelekea barabarani tu wakati kuna trafiki kidogo.",
                                        "Planta miti/vibanzi karibu na nyumba kama kizuizi cha uzalishaji."
                                    ],
                                    "title": "Karibu na barabara yenye shughuli nyingi",
                                },
                                {
                                    "content": [
                                        "Mfiduo wako kwa uchafuzi wa hewa ni mdogo kwani hakuna uzalishaji wa magari.",
                                    ],
                                    "title": "Barabara yenye shughuli kidogo au hakuna",
                                }
                            ]
                        },
                        {
                            "title": "Marangapi unashiriki katika shughuli za nje?",
                            "context": "Shughuli za nje",
                            "answers": [
                                {
                                    "content": [
                                        "Fuatilia ubora wa hewa na utabiri wa hali ya hewa katika eneo lako kupitia programu ya AirQo ili kuepuka shughuli za nje siku za hewa mbaya.",
                                        "Chagua wakati wa chini wa uchafuzi kama asubuhi mapema au usiku wa manane.",
                                        "Panga shughuli zako karibu na barabara zisizo na shughuli nyingi au maeneo ya kijani."
                                    ],
                                    "title": "Kila mara",
                                },
                                {
                                    "content": [
                                        "Angalia ubora wa hewa na utabiri wa hali ya hewa katika eneo lako kupitia programu ya AirQo ili kuepuka shughuli za nje siku za hewa mbaya.",
                                        "Punguza muda wa shughuli za nje siku ambazo ubora wa hewa ni mbaya."
                                    ],
                                    "title": "Mara kwa mara",
                                },
                                {
                                    "content": [
                                        "Kwa watu ambao hawashiriki katika shughuli za nje, fikiria chaguo za mazoezi ndani, kama kutumia treadmill, baiskeli ya mazoezi au kuhudhuria madarasa ya mazoezi.",
                                        "Tumia programu ya AirQo kuangalia ubora wa hewa na utabiri katika eneo lako ili kupanga mapema shughuli za nje.",
                                        "Fikiria kupunguza mfiduo wako kwa uchafuzi wa hewa nyumbani kwa kuepuka kuchoma taka nje na kuongeza uingizaji hewa ndani ya nyumba wakati unafanya shughuli za kutoa uchafuzi."
                                    ],
                                    "title": "Mara chache/Asilani",
                                }
                            ]
                        },
                        {
                            "title": "Unatumia aina gani ya barabara mara kwa mara?",
                            "context": "Usafiri",
                            "answers": [
                                {
                                    "content": [
                                        "Funga madirisha na milango wakati wa siku zenye vumbi, haswa wakati wa upepo.",
                                        "Vaa barakoa au funika pua/mdomo wako na kitambaa kama leso/kitambaa unapokuwa na vumbi.",
                                        "Usisahau kuangalia ubora wa hewa na utabiri katika eneo lako kupitia programu ya AirQo ili kupanga mapema siku za ubora mbaya wa hewa."
                                    ],
                                    "title": "Barabara chafu/isiyolainishwa",
                                },
                                {
                                    "content": [
                                        "Kuishi karibu na barabara za lami kunakufanya upate vumbi kidogo, lakini uzalishaji wa magari unaweza bado kuathiri ubora wa hewa.",
                                        "Panda miti/mimea karibu na nyumba yako kama kinga ya asili ya kunyonya vichafuzi."
                                    ],
                                    "title": "Barabara ya lami/barabara yenye vumbi kidogo",
                                }
                            ]
                        },
                        {
                            "title": "Ni njia gani ya usafiri unayotumia zaidi?",
                            "context": "Usafiri",
                            "answers": [
                                {
                                    "content": [
                                        "Tunza gari lako mara kwa mara ili kuwa na injini yenye afya inayopunguza uzalishaji.",
                                        "Epuka kuacha gari ikiwa na injini ikiwa inawezekana.",
                                        "Unapoweza, fanya safari za pamoja na watu wengine kupunguza idadi ya magari barabarani."
                                    ],
                                    "title": "Gari",
                                },
                                {
                                    "content": [
                                        "Matumizi ya usafiri wa umma yanaweza kupunguza idadi ya magari barabarani. Hii inapunguza uzalishaji wa magari na mfiduo kwa uchafuzi wa hewa."
                                    ],
                                    "title": "Taxi au basi",
                                },
                                {
                                    "content": [
                                        "Unapotumia boda boda, vaa barakoa kulinda dhidi ya kunasa vumbi na vichafuzi.",
                                        "Madereva wa boda boda wanahimizwa kufanya matengenezo sahihi ya injini."
                                    ],
                                    "title": "Boda boda",
                                },
                                {
                                    "content": [
                                        "Tembea kwenye njia za pekee kutoka barabarani, kwani hii itasaidia kupunguza mfiduo kwa uzalishaji wa magari.",
                                        "Kabla ya kuanza safari, angalia ubora wa hewa katika eneo lako kupitia programu ya AirQo. Fikiria kutumia njia za usafiri mbadala au njia nyingine ikiwa ubora wa hewa ni mbaya.",
                                        "Vaa barakoa ikiwa unatembea wakati wa masaa ya juu ya uchafuzi, kama asubuhi mapema (kuanzia saa 7 asubuhi hadi saa 10 alasiri) na jioni wakati wa msongamano wa trafiki.",
                                        "Ikiwezekana, chagua njia zinazopita mbali na maeneo yenye vyanzo vya uchafuzi vinavyojulikana, kama vile maeneo ya ujenzi au viwanda."
                                    ],
                                    "title": "Tembea",
                                }
                            ]
                        }
                    ]
                }
            ];
            break;

    }
    return translatedQuizzes[index];

}



module.exports = translateUtil;