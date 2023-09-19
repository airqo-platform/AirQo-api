require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const { expect } = chai;
chai.use(sinonChai);
const httpStatus = require("http-status");

const translateUtil = require("@utils/translate");

describe('translateUtil', () => {
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

        const result = await translateUtil.translate(healthTips, targetLanguage);


        expect(result).to.have.property('success', true);
        for (let i = 0; i < result.data.length; i++) {
            expect(result.data[i].title).to.equal(expectedTranslations[i].title);
            expect(result.data[i].description).to.equal(expectedTranslations[i].description);
        }
    }).timeout(10000);

    it('should handle translation errors gracefully', async () => {

        const healthTips = null;
        const targetLanguage = 'fr';
        const result = await translateUtil.translate(healthTips, targetLanguage);

        expect(result).to.have.property('success', false);
        expect(result).to.have.property('message', 'Internal Server Error');
        expect(result).to.have.property('status', 500);
        expect(result).to.have.property('errors');
        expect(result.errors).to.have.property('message');
    });
});