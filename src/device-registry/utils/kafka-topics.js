const TOPICS = {
    RAW_MEASUREMENTS_TOPICS,
    GET_SITE_DISTANCES
}

const getTopic = async (topicConstant) => {

    let topic;

    switch (topicConstant) {
        case TOPICS.GET_SITE_DISTANCES:
            topic = process.env.GET_SITE_DISTANCES;
            break;
    
        case TOPICS.RAW_MEASUREMENTS_TOPICS:
            topic = process.env.RAW_MEASUREMENTS_TOPICS;
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

module.exports = { getTopic, TOPICS };
