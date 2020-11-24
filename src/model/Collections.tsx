import { useContext } from "react";
import { getDisplayNamesFromLanguageCode, ILanguage } from "./Language";
import {
    CachedTablesContext,
    CachedTables,
} from "../model/InternationalizedContent";
import { ICollection, IRawCollection } from "./ContentInterfaces";
import { convertContentfulCollectionToICollection } from "./Contentful";
import { strict as assert } from "assert";
import { useContentful } from "../connection/UseContentful";
import { useGetLoggedInUser } from "../connection/LoggedInUser";
import { IFilter } from "../IFilter";
import { ITopic } from "./useInternationalizedTopics";

/* From original design: Each collection has
    id
    label
    child collections [ 0  or more ] (potentially ordered?)
    book query (optional)
    pageType (optional)
    banner specification (optional)
    card icon (optional)
    A (potentially ordered) set of books ←- this comes from Parse, not Contentful

    Banner
        ID
        Background Image (optional) We use the “card icon” if this is missing (e.g. all publishers)
        Image Credits
        Blurb
*/

interface IContentfulCollectionQueryResponse {
    collection?: ICollection;
    loading: boolean; // Hook response loading || !fetched, that is, we don't actually have a result yet
}

// A hook function for retrieving collections from contentful.
function useGetContentfulCollections(): IRawCollection[] {
    // Get every collection in Contentful
    const { loading, result } = useContentful({
        content_type: "collection",
        include: 10, // depth
    });
    if (loading) {
        return [];
    }
    return result as IRawCollection[];
}

// Basically a map of collectionName to ICollection
const collectionCache: any = {};

// A hook function for working with collections, generally retrieved from contentful.
// If `collections` or `languages` is not yet populated,
// it will return a result with loading true and the collection undefined.
// When the query is complete a state change will cause it to be called again and return a useful result.
// In some cases, if a collection is not found on contentful, it is generated by code here.
// If collectionName is falsy, returns a result with loading:false and no other data.
export function useGetCollection(
    collectionName?: string
): IContentfulCollectionQueryResponse {
    const collections = useGetContentfulCollections();
    const { languagesByBookCount: languages } = useContext(CachedTablesContext);
    const user = useGetLoggedInUser(); // for collection 'my-books'

    if (!collectionName) {
        return { loading: false };
    }

    if (!user && collectionName === "my-books") {
        // There must be a logged in user for the 'my-books' option to be available.
        // But we can get here if the 'useGetLoggedInUser()' call hasn't returned yet.
        return { loading: true };
    }

    if (!collections.length || !languages.length) {
        return { loading: true };
    }

    if (collectionCache[collectionName]) {
        return {
            loading: false,
            collection: collectionCache[collectionName],
        };
    }

    // We have template collections for everything, and then also we can provide
    // override collections for any value. E.g. our query will first look for a
    // collection named "Language:en", but then if that is not found, it will
    // return "[Template Language Collection]".
    const nameParts = collectionName.split(":");
    let templateKey = "-";
    if (nameParts.length > 1) {
        templateKey = `[Template ${Capitalize(nameParts[0])} Collection]`;
    }

    let templateFacetCollection: ICollection | undefined;
    let explicitCollection: ICollection | undefined;

    collections.forEach((item: IRawCollection) => {
        if (item.fields.urlKey === templateKey) {
            templateFacetCollection = convertContentfulCollectionToICollection(
                item
            );
        } else if (item.fields.urlKey === collectionName) {
            explicitCollection = convertContentfulCollectionToICollection(item);
        }
    });
    // console.log(`nameparts = ${JSON.stringify(nameParts)}`);
    // console.log(`collections=${JSON.stringify(collections)}`);
    assert(
        templateFacetCollection || nameParts.length === 1,
        `If it's a facetted collection, we should have a template for it. nameparts = ${JSON.stringify(
            nameParts
        )}  `
    );

    let collection: ICollection | undefined;
    if (templateFacetCollection) {
        collection = getFacetCollection(
            nameParts[0],
            nameParts[1],
            templateFacetCollection,
            explicitCollection, // may or may not be defined
            languages
        );
    } else if (explicitCollection) {
        if (explicitCollection.urlKey === "topics") {
            // We currently generate the one collection for each topic, just
            // for showing the cards. If someone clicks a card, well then we
            // go and see what the collection should really be. If we ever
            // want to use icons on the card, then we can just remove this
            // whole block and instead populate the "Topics" collection on
            // Contentful
            explicitCollection.childCollections = makeTopicCollectionsForCards();
        }
        if (explicitCollection.urlKey === "my-books") {
            if (user) {
                const email = user.email;
                if (email) {
                    const filterOnUserAsUploader: IFilter = {};
                    filterOnUserAsUploader.search = `uploader:${email}`;
                    explicitCollection.filter = filterOnUserAsUploader;
                }
            }
        }
        collection = explicitCollection;
    }
    if (collection) {
        collectionCache[collectionName] = collection;
        return { loading: false, collection };
    }

    return { loading: false };
}

function getFacetCollection(
    facet: string,
    value: string,
    templateCollection: ICollection,
    explicitCollection: ICollection | undefined,
    languages: ILanguage[]
): ICollection {
    /* --- ENHANCE: Currently if we have a leading colon, e.g. bloomlibrary.org/:keyword:foo, we won't get to use the
    "[Template Keyword Collection]", nor the actual "keyword:foo" collection from CF, if it exists.
    This is because the leading colon triggers the CollectionSubsetPage, which only creates and applies a filter to
    the root collection. */

    switch (facet) {
        case "language":
            // language collections are optionally generated. We can make real cards if we
            // want, to give a more interesting background image etc, but if we don't have
            // one for a language, we generate a default here.
            // We currently don't need to mess with the actual content of the languages
            // collection because a special case in CollectionPage for the language-chooser urlKey
            // creates a special LanguageGroup row, which determines the children directly
            // from the main database.
            return makeLanguageCollection(
                templateCollection,
                explicitCollection,
                value,
                languages
            );

        case "topic":
            let currentTopic = CachedTables.topics.find(
                (topic) => topic.key === value
            );
            if (!currentTopic) {
                currentTopic = {
                    key: value,
                    displayName: value,
                };
            }
            // topic collections currently are generated from the fixed list above.
            // the master "topics" collection is real (so it can be included at the
            // right place in its parent) but its children are inserted by another special case.
            return makeTopicCollection(
                templateCollection,
                explicitCollection,
                currentTopic
            );

        // case "keyword":
        //     collection = makeCollectionForKeyword(collection, value);
        //     return { collection, loading: false };

        case "search":
            // search collections are generated from a search string the user typed.
            return makeCollectionForSearch(templateCollection, value);

        case "phash":
            // search collections are generated from a search string the user typed.
            return makeCollectionForPHash(templateCollection, value);

        default:
            throw Error(`Unknown facet: ${facet}`);
    }
}

// If we don't find a contentful collection for language:xx, we create one.
export function makeLanguageCollection(
    templateCollection: ICollection,
    explicitCollection: ICollection | undefined,
    langCode: string,
    languages: ILanguage[]
): ICollection {
    let languageDisplayName = getDisplayNamesFromLanguageCode(
        langCode!,
        languages
    )?.combined;
    if (!languageDisplayName) languageDisplayName = langCode;

    // We need the label in [Template Language Collection] to be $1.
    // Then we allow an explicit collection to define its own label, else we
    // need it to have "$1" in the label.

    let label = explicitCollection?.label
        ? explicitCollection.label.replace("$1", languageDisplayName)
        : templateCollection.label.replace("$1", languageDisplayName);
    // if we still don't have anything
    label = label || languageDisplayName;
    return {
        // last wins
        ...templateCollection,
        ...explicitCollection,
        urlKey: "language:" + langCode,
        filter: { language: langCode },
        label,
    };
}

export function makeTopicCollection(
    templateCollection: ICollection,
    explicitCollection: ICollection | undefined,
    topic: ITopic
): ICollection {
    // last wins
    return {
        iconForCardAndDefaultBanner: {
            url: "none",
            altText: "none",
            credits: "none",
        },
        ...templateCollection,
        ...explicitCollection,
        urlKey: "topic:" + topic.key,
        label:
            templateCollection.label.replace("$1", topic.displayName) ||
            topic.displayName,
        filter: { topic: topic.key },
    };
}

export function makeCollectionForSearch(
    templateCollection: ICollection,
    search: string,
    baseCollection?: ICollection
): ICollection {
    const filter = { ...baseCollection?.filter, search };
    let label = 'Books matching "' + decodeURIComponent(search) + '"';
    // The root.read is a special case that is always unmarked...not including
    // it's label allows us to, for example, see "Bloom Library: Books matching dogs"
    // rather than "Bloom Library: Read - Books matching dogs"
    if (baseCollection?.urlKey !== "root.read" && baseCollection?.label) {
        label = baseCollection.label + " - " + label;
    }
    let urlKey = ":search:" + search;
    if (baseCollection?.urlKey) {
        urlKey = baseCollection.urlKey + "/" + urlKey;
    }
    // Enhance: how can we modify title to indicate that it's restricted to books matching a search,
    // given that it's some unknown contentful representation of a rich text?
    const result: ICollection = {
        ...templateCollection,
        ...baseCollection,
        filter,
        label,
        urlKey,
    };
    return result;
}

export function makeCollectionForPHash(
    templateCollection: ICollection,
    phash: string
): ICollection {
    // review: would it be cleaner to make phash a top-level field in filter?
    // Would require changes to the LibraryQueryHooks function for interpreting
    // filter. It's also remotely possible that losing the ability to type
    // a phash: into the search box would be missed.
    const filter = { search: "phash:" + phash };
    const urlKey = "phash:" + phash;
    const result: ICollection = {
        ...templateCollection,
        filter,
        urlKey,
        childCollections: [],
    };
    return result;
}

export function getDummyCollectionForPreview(bannerId: string): ICollection {
    return {
        label: "dummy",
        urlKey: "dummy",
        filter: {},
        childCollections: [],
        bannerId,
        iconForCardAndDefaultBanner: undefined,
        layout: "by-level",
        type: "collection",
        description: "",
    };
}
// These are just for cards. At this point it would not be possible to override what we see on a topic
// card. But once you click the card, then you're going to topic:foo and we would pick up any explicit
// "topic:foo" collection.
function makeTopicCollectionsForCards(): ICollection[] {
    return (
        [...CachedTables.topics]
            // Don't need an "Other" topic when displaying various topics on the home page
            .filter((t: ITopic) => t.key !== "Other")
            .sort(topicSort)
            .map((t: ITopic) =>
                makeTopicCollection(
                    {
                        urlKey: "topic:" + t.key,
                        label: t.displayName,
                        childCollections: [],
                        filter: { topic: t.key },
                        bannerId: "", // this will never be used because it's just for the card
                        layout: "by-level", // this will never be used because it's just for the card
                        type: "collection",
                        description: "",
                    },
                    undefined,
                    t
                )
            )
    );
}

function topicSort(a: ITopic, b: ITopic): number {
    const key1 = a.displayName;
    const key2 = b.displayName;
    if (key1 === key2) {
        return 0;
    }
    return key1 > key2 ? 1 : -1;
}

/* We're thinking (but not certain) that we just want to treat keyword lookups as searches (which will of course
    find books that have this explicit keyword *

    export function makeCollectionForKeyword(
    templateCollection: ICollection,
    keyword: string,
    baseCollection?: ICollection
): ICollection {
    const filter: IFilter = {
        ...baseCollection?.filter,
        keywordsText: keyword,
    };
    let label = "Books with keyword " + keyword;
    if (baseCollection?.label) {
        label = baseCollection.label + " - " + label;
    }

    let urlKey = "keyword:" + keyword;
    if (baseCollection?.urlKey) {
        urlKey = baseCollection.urlKey + "/" + urlKey;
    }
    // Enhance: how can we append "- keyword" to title, given that it's some unknown
    // contentful representation of a rich text?
    return {
        ...templateCollection,
        ...baseCollection,
        filter,
        label,
        urlKey,
        childCollections: [],
        iconForCardAndDefaultBanner: undefined,
    };
}*/

function Capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
