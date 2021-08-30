const TOPICS = {
    AIRQO_RAW_MEASUREMENTS: "AIRQO_RAW_MEASUREMENTS",
    KCCA_RAW_MEASUREMENTS: "KCCA_RAW_MEASUREMENTS",
    AIRQO_CALIBRATED_MEASUREMENTS: "AIRQO_CALIBRATED_MEASUREMENTS",
    SITE_DISTANCES: "SITE_DISTANCES",
    COMPUTE_SITE_DISTANCES: "COMPUTE_SITE_DISTANCES"
}
Object.freeze(TOPICS);

const getTopic = (topicConstant) => {

    let topic = "";

    switch (topicConstant) {
        case TOPICS.AIRQO_RAW_MEASUREMENTS:
            topic = process.env.AIRQO_RAW_MEASUREMENTS_TOPIC;
            break;
    
        case TOPICS.KCCA_RAW_MEASUREMENTS:
            topic = process.env.KCCA_RAW_MEASUREMENTS_TOPIC;
            break;

        case TOPICS.AIRQO_CALIBRATED_MEASUREMENTS:
            topic = process.env.AIRQO_CALIBRATED_MEASUREMENTS_TOPIC;
            break;
        
        case TOPICS.SITE_DISTANCES:
            topic = process.env.SITE_DISTANCES_TOPIC;
            break;

        case TOPICS.COMPUTE_SITE_DISTANCES:
            topic = process.env.COMPUTE_SITE_DISTANCES_TOPIC;
            break;

        default:
            topic = undefined;
            break;
    }

    if (topic == undefined){
        throw new Error(topicConstant + ' doesnot exist in your environment variables');
    }

    return topic;
}

const getTopics = () => {

    let topics = getTopic(TOPICS.AIRQO_CALIBRATED_MEASUREMENTS) + "," + 
    getTopic(TOPICS.AIRQO_RAW_MEASUREMENTS) + "," + 
    getTopic(TOPICS.KCCA_RAW_MEASUREMENTS);

    return [...new Set(topics.split(","))];
}

module.exports = { getTopic, TOPICS, getTopics };
