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

            for (const healthTip of healthTips) {
                const translatedTip = { ...healthTip };
                translatedTip.title = await translateText(healthTip.title, targetLanguage);
                translatedTip.description = await translateText(healthTip.description, targetLanguage);

                translatedHealthTips.push(translatedTip);
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

            for (const lesson of lessons) {
                const translatedLesson = { ...lesson };
                translatedLesson.title = await translateText(lesson.title, targetLanguage);
                translatedLesson.completion_message = await translateText(lesson.completion_message, targetLanguage);
                const translatedTasks = [];
                for (const task of lesson.tasks) {
                    const translatedTask = { ...task };
                    translatedTask.title = await translateText(task.title, targetLanguage);
                    translatedTask.content = await translateText(task.content, targetLanguage);
                    translatedTasks.push(translatedTask);
                }
                translatedLesson.tasks = translatedTasks
                translatedLessons.push(translatedLesson);
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
            for (const quiz of quizzes) {
                const translatedQuiz = { ...quiz };
                translatedQuiz.title = await translateText(quiz.title, targetLanguage);
                translatedQuiz.description = await translateText(quiz.description, targetLanguage);
                translatedQuiz.completion_message = await translateText(quiz.completion_message, targetLanguage);
                const translatedQuestions = [];
                for (const question of quiz.questions) {
                    const translatedQuestion = { ...question };
                    translatedQuestion.title = await translateText(question.title, targetLanguage);
                    translatedQuestion.context = await translateText(question.context, targetLanguage);
                    const translatedAnswers = [];
                    for (const answer of question.answers) {
                        const translatedAnswer = { ...answer };
                        translatedAnswer.title = await translateText(answer.title, targetLanguage);
                        const translatedContent = [];
                        for (const contentItem of answer.content) {
                            const translatedItem = await translateText(contentItem, targetLanguage);
                            translatedContent.push(translatedItem);
                        }
                        translatedAnswer.content = translatedContent;

                        translatedAnswers.push(translatedAnswer);
                    }
                    translatedQuestion.answers = translatedAnswers;
                    translatedQuestions.push(translatedQuestion);
                }
                translatedQuiz.questions = translatedQuestions
                translatedQuizzes.push(translatedQuiz);
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