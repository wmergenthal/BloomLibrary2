import React from "react";
import { ICollection } from "../model/ContentInterfaces";
import { BookCardGroup } from "./BookCardGroup";
import { kTopicList } from "../model/ClosedVocabularies";
import { getTranslation } from "../localization/GetLocalizations";
import { kNameOfNoTopicCollection } from "../connection/LibraryQueryHooks";

export const TopicsList = [
    "Agriculture",
    "Animal Stories",
    "Business",
    "Dictionary",
    "Environment",
    "Primer",
    "Math",
    "Culture",
    "Science",
    "Story Book",
    "Traditional Story",
    "Health",
    "Personal Development",
    "Spiritual",
];

// For each topic, show a row of books for that topic.
// Note: very similar to ByLevelsGroup, possibly we can factor out something common.
export const ByTopicsGroups: React.FunctionComponent<{
    collection: ICollection;
}> = (props) => {
    const contextLangIso = props.collection.urlKey.startsWith("language:")
        ? props.collection.urlKey.substring("language:".length)
        : undefined;

    // const otherTopic = TopicsList.find(
    //     (topic: ITopic) => topic.key === "Other"
    // ) as ITopic;
    return (
        <React.Fragment>
            {kTopicList.map((topic) => (
                <BookCardGroup
                    key={topic}
                    collection={makeCollectionForTopic(props.collection, topic)}
                    contextLangIso={contextLangIso}
                />
            ))}

            {/* Show books that don't have a topic */}
            <BookCardGroup
                rows={99}
                collection={makeCollectionForTopic(
                    props.collection,
                    kNameOfNoTopicCollection
                )}
                contextLangIso={contextLangIso}
            />
        </React.Fragment>
    );
};

export function makeCollectionForTopic(
    baseCollection: ICollection,
    topic: string
): ICollection {
    const filter = { ...baseCollection.filter, topic };
    const label =
        baseCollection.label + ` - ${getTranslation("topic." + topic, topic)}`;
    const urlKey = baseCollection.urlKey + "/:topic:" + topic;
    // Enhance: how can we append "- topic" to title, given that it's some unknown
    // contentful representation of a rich text?
    const result = {
        ...baseCollection,
        filter,
        label,
        title: label,
        urlKey,
    };
    return result;
}

// Todo: something needs to handle /topic:X in a /more/ url
// need to get layout into collection
