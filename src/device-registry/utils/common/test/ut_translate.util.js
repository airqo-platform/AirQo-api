require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const { expect } = chai;
chai.use(sinonChai);
const httpStatus = require("http-status");

const { translate } = require("@utils/common");

describe("translate", () => {
  describe("translateTips", () => {
    it("should translate health tips to the target language", async () => {
      const healthTips = [
        {
          title: "For Everyone",
          description:
            "If you have to spend a lot of time outside, disposable masks like the N95 are helpful.",
        },
      ];
      const targetLanguage = "fr";

      const expectedTranslations = [
        {
          title: "Pour tout le monde",
          description:
            "Si vous devez passer beaucoup de temps dehors, les masques jetables comme le N95 sont utiles.",
        },
      ];

      const result = await translate.translateTips(healthTips, targetLanguage);
      expect(result).to.have.property("success", true);
      for (let i = 0; i < result.data.length; i++) {
        expect(result.data[i].title).to.equal(expectedTranslations[i].title);
        expect(result.data[i].description).to.equal(
          expectedTranslations[i].description
        );
      }
    }).timeout(10000);

    it("should handle translation errors gracefully", async () => {
      const next = sinon.spy();
      await translate.translateTips({ healthTips: null, targetLanguage: "fr" }, next);

      expect(next).to.have.been.calledOnce;
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(err.message).to.equal("Internal Server Error");
      expect(err.errors).to.have.property("message");
    });
  });

  describe("translateLessons", () => {
    it("should translate Kya lessons to the target language", async () => {
      const kyaLessons = [
        {
          _id: "testId",
          title: "Actions you can take to reduce air pollution",
          completion_message:
            "You just finished your first Know Your Air Lesson",
          image: "https://testimage",
          tasks: [
            {
              _id: "testId",
              title: "Use public transport",
              content:
                "Vehicle exhaust is a major source of air pollution. Less cars on the road results in less emissions.",
              image: "https://testimage",
              task_position: 2,
            },
          ],
        },
      ];
      const targetLanguage = "fr";

      const expectedTranslations = [
        {
          _id: "testId",
          title:
            "Mesures que vous pouvez prendre pour réduire la pollution de l’air",
          completion_message:
            "Vous venez de terminer votre première leçon Know Your Air.",
          image: "https://testimage",
          tasks: [
            {
              _id: "testId",
              title: "Utilisez les transports en commun",
              content:
                "Les gaz d’échappement des véhicules constituent une source majeure de pollution atmosphérique. Moins de voitures sur la route entraîne moins d’émissions.",
              image: "https://testimage",
              task_position: 2,
            },
          ],
        },
      ];

      const result = await translate.translateLessons(
        kyaLessons,
        targetLanguage
      );

      expect(result).to.have.property("success", true);
      for (let i = 0; i < result.data.length; i++) {
        expect(result.data[i].title).to.equal(expectedTranslations[i].title);
        expect(result.data[i].completion_message).to.equal(
          expectedTranslations[i].completion_message
        );
        expect(result.data[i].tasks).to.deep.equal(
          expectedTranslations[i].tasks
        );
      }
    }).timeout(10000);

    it("should handle translation errors gracefully", async () => {
      const next = sinon.spy();
      await translate.translateLessons({ lessons: null, targetLanguage: "fr" }, next);

      expect(next).to.have.been.calledOnce;
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(err.message).to.equal("Internal Server Error");
      expect(err.errors).to.have.property("message");
    });
  });
  describe("translateQuizzes", () => {
    it("should translate Kya Quizzes to the target language", async () => {
      const kyaQuizzes = [
        {
          _id: "testId",
          title: "Get personalised air quality recommendations",
          description:
            "Tell us more about Air Quality conditions in your environment & get personalised tips.",
          completion_message:
            "Way to go🎊. You have unlocked personalised air quality recommendations to empower you on your clean air journey.",
          image: "https//testImage",
          questions: [
            {
              title: "Where is your home environment situated?",
              context: "Home environment",
              question_position: 1,
              answers: [
                {
                  content: [
                    "Cooking with firewood can emit significant amounts of air pollutants.",
                    "Cook in a well-ventilated kitchen with good airflow or set up an outdoor kitchen if possible.",
                    "Use an efficient stove designed to burn firewood more cleanly and with less smoke.",
                    "Consider switching to improved cookstoves that reduce emissions and increase fuel efficiency.",
                  ],
                  title: "Firewood",
                },
              ],
            },
          ],
        },
      ];

      const targetLanguage = "pt";

      const expectedTranslations = [
        {
          _id: "testId",
          title:
            "Descubra aqui suas dicas personalizadas sobre a qualidade do ar!",
          description:
            "Responda a este questionário sobre o seu ambiente e rotina diária para desbloquear dicas personalizadas exclusivas para você!",
          completion_message:
            "Proceda. Você desbloqueou recomendações personalizadas sobre a qualidade do ar para ajudá-lo em sua jornada rumo ao ar puro.",
          image: "https//testImage",
          questions: [
            {
              title: "Que método de cozimento você utiliza em casa?",
              context: "Ambiente doméstico",
              question_position: 1,
              answers: [
                {
                  content: [
                    "Cozinhar com lenha pode emitir quantidades significativas de poluentes atmosféricos.",
                    "Cozinhe em uma cozinha bem ventilada com boa circulação de ar ou instale uma cozinha ao ar livre, se possível.",
                    "Use um fogão eficiente projetado para queimar lenha de forma mais limpa e com menos fumaça.",
                    "Considere a transição para fogões melhorados que reduzem as emissões e aumentam a eficiência energética.",
                  ],
                  title: "Lenha",
                },
              ],
            },
          ],
        },
      ];

      const result = await translate.translateQuizzes(
        kyaQuizzes,
        targetLanguage
      );

      expect(result).to.have.property("success", true);
      for (let i = 0; i < result.data.length; i++) {
        expect(result.data[i].title).to.equal(expectedTranslations[i].title);
        expect(result.data[i].completion_message).to.equal(
          expectedTranslations[i].completion_message
        );
        expect(result.data[i].questions).to.deep.equal(
          expectedTranslations[i].questions
        );
        expect(result.data[i].questions.answers).to.deep.equal(
          expectedTranslations[i].questions.answers
        );
      }
    }).timeout(10000);

    it("should handle translation errors gracefully", async () => {
      const next = sinon.spy();
      await translate.translateQuizzes({ quizzes: null, targetLanguage: "fr" }, next);

      expect(next).to.have.been.calledOnce;
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(err.message).to.equal("Internal Server Error");
      expect(err.errors).to.have.property("message");
    });
  });
});
