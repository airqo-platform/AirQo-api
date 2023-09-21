require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const { expect } = chai;
chai.use(sinonChai);
const httpStatus = require("http-status");

const translateUtil = require("@utils/translate");

describe('translateUtil', () => {
    describe("translateTips", () => { 
        it('should translate health tips to the target language', async () => {
            const healthTips = [
                {
                    title: 'Hello',
                    description: 'World',
                },
                {
                    title: 'Good',
                    description: 'Morning',
                },
            ];
            const targetLanguage = 'fr';

            const expectedTranslations = [
                {
                    title: 'Bonjour',
                    description: 'Monde',
                },
                {
                    title: 'Bien',
                    description: 'Matin',
                },
            ];

            const result = await translateUtil.translateTips(healthTips, targetLanguage);


            expect(result).to.have.property('success', true);
            for (let i = 0; i < result.data.length; i++) {
                expect(result.data[i].title).to.equal(expectedTranslations[i].title);
                expect(result.data[i].description).to.equal(expectedTranslations[i].description);
            }
        }).timeout(10000);

        it('should handle translation errors gracefully', async () => {

            const healthTips = null;
            const targetLanguage = 'fr';
            const result = await translateUtil.translateTips(healthTips, targetLanguage);

            expect(result).to.have.property('success', false);
            expect(result).to.have.property('message', 'Internal Server Error');
            expect(result).to.have.property('status', 500);
            expect(result).to.have.property('errors');
            expect(result.errors).to.have.property('message');
        });
    })

    describe("translateLessons", () => {
        it('should translate Kya lessons to the target language', async () => {
            const kyaLessons = [
                {
                    "_id": "testId",
                    "title": "Actions you can take to reduce air pollution",
                    "completion_message": "You just finished your first Know Your Air Lesson",
                    "image": "https://testimage",
                    "tasks": [
                        {
                            "_id": "testId",
                            "title": "Use public transport",
                            "content": "Vehicle exhaust is a major source of air pollution. Less cars on the road results in less emissions.",
                            "image": "https://testimage",
                            "task_position": 2
                        },
                    ]
                }
            ];
            const targetLanguage = 'fr';

            const expectedTranslations = [
                {
                    "_id": "testId",
                    "title": "Mesures que vous pouvez prendre pour réduire la pollution de l’air",
                    "completion_message": "Vous venez de terminer votre première leçon Know Your Air.",
                    "image": "https://testimage",
                    "tasks": [
                        {
                            "_id": "testId",
                            "title": "Utilisez les transports en commun",
                            "content": "Les gaz d’échappement des véhicules constituent une source majeure de pollution atmosphérique. Moins de voitures sur la route entraîne moins d’émissions.",
                            "image": "https://testimage",
                            "task_position": 2
                        },
                    ]
                }
            ];

            const result = await translateUtil.translateLessons(kyaLessons, targetLanguage);


            expect(result).to.have.property('success', true);
            for (let i = 0; i < result.data.length; i++) {
                expect(result.data[i].title).to.equal(expectedTranslations[i].title);
                expect(result.data[i].completion_message).to.equal(expectedTranslations[i].completion_message);
                expect(result.data[i].tasks).to.deep.equal(expectedTranslations[i].tasks);
            }
        }).timeout(10000);

        it('should handle translation errors gracefully', async () => {

            const lessons = null;
            const targetLanguage = 'fr';
            const result = await translateUtil.translateLessons(lessons, targetLanguage);

            expect(result).to.have.property('success', false);
            expect(result).to.have.property('message', 'Internal Server Error');
            expect(result).to.have.property('status', 500);
            expect(result).to.have.property('errors');
            expect(result.errors).to.have.property('message');
        });
    });
    describe("translateQuizzes", () => {
        it('should translate Kya Quizzes to the target language', async () => {
            const kyaQuizzes = [
                {
                    "_id": "testId",
                    "title": "Get personalised air quality recommendations",
                    "description": "Tell us more about Air Quality conditions in your environment & get personalised tips.",
                    "completion_message": "Way to go🎊. You have unlocked personalised air quality recommendations to empower you on your clean air journey.",
                    "image": "https//testImage",
                    "questions": [
                        {
                            "title": "Where is your home environment situated?",
                            "context": "Home environment",
                            "question_position": 1,
                            "answers": [
                                {
                                    "content": [
                                        "Cooking with firewood can emit significant amounts of air pollutants.",
                                        "Cook in a well-ventilated kitchen with good airflow or set up an outdoor kitchen if possible.",
                                        "Use an efficient stove designed to burn firewood more cleanly and with less smoke.",
                                        "Consider switching to improved cookstoves that reduce emissions and increase fuel efficiency."
                                    ],
                                    "title": "Firewood",
                                }
                            ]
                        },
                    ],
                },
            ];

            const targetLanguage = 'fr';

            const expectedTranslations = [
                {
                    "_id": "testId",
                    "title": "Obtenez des recommandations personnalisées sur la qualité de l'air",
                    "description": "Dites-nous en plus sur les conditions de qualité de l'air dans votre environnement et obtenez des conseils personnalisés.",
                    "completion_message": "Bravo🎊. Vous avez débloqué des recommandations personnalisées sur la qualité de l'air pour vous aider dans votre voyage vers un air pur.",
                    "image": "https//testImage",
                    "questions": [
                        {
                            "title": "Où se situe votre environnement domestique ?",
                            "context": "Environnement de la maison",
                            "question_position": 1,
                            "answers": [
                                {
                                    "content": [
                                        "Cuisiner avec du bois de chauffage peut émettre des quantités importantes de polluants atmosphériques.",
                                        "Cuisinez dans une cuisine bien ventilée avec une bonne circulation d’air ou installez une cuisine extérieure si possible.",
                                        "Utilisez un poêle efficace conçu pour brûler du bois de chauffage plus proprement et avec moins de fumée.",
                                        "Envisagez de passer à des cuisinières améliorées qui réduisent les émissions et augmentent le rendement énergétique."
                                    ],
                                    "title": "Bois de chauffage",
                                }
                            ]
                        },
                    ],
                },
            ];

            const result = await translateUtil.translateQuizzes(kyaQuizzes, targetLanguage);


            expect(result).to.have.property('success', true);
            for (let i = 0; i < result.data.length; i++) {
                expect(result.data[i].title).to.equal(expectedTranslations[i].title);
                expect(result.data[i].completion_message).to.equal(expectedTranslations[i].completion_message);
                expect(result.data[i].questions).to.deep.equal(expectedTranslations[i].questions);
                expect(result.data[i].questions.answers).to.deep.equal(expectedTranslations[i].questions.answers);
            }
        }).timeout(10000);

        it('should handle translation errors gracefully', async () => {

            const kyaQuizzes = null;
            const targetLanguage = 'fr';
            const result = await translateUtil.translateQuizzes(kyaQuizzes, targetLanguage);

        expect(result).to.have.property('success', false);
        expect(result).to.have.property('message', 'Internal Server Error');
        expect(result).to.have.property('status', 500);
        expect(result).to.have.property('errors');
        expect(result.errors).to.have.property('message');
    });
});
});