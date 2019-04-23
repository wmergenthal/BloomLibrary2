import React from "react";
import { css, cx } from "emotion";
import { useQueryBlorgClass } from "./useQueryBlorg";
import { getResultsOrMessageElement } from "./useQueryBlorg";
import CategoryCard from "./CategoryCard";

interface IProps {
    title: string;
    bookShelfCategory: string; // project, org, publisher, custom
    parentBookshelf?: string;
}
/* This lets use show bookshelves. Not the books in them, but the list of shelves, themeselves.
    It's not obvious that we want/need the current system with bookshelves which live in the database.
    On the one hand, we may find we need to do code work anyhow to do a good job of presenting a shelf
    anyhow, so why not just locate it in the code.

    On the other hand, we will eventually need to support user-generated shelves. We may also eventually
    need to support alternate book library sites, and those would be even more driven by database
    instead of code.

    So for the moment, I'm just leaving things as they are. We can query for all bookshelves, but the
    home page will also choose to feature Enabling writers, from code. So it's a mix of approaches
    for now.
*/

export const BookshelfGroup: React.FunctionComponent<IProps> = props => {
    // At this point there are so few bookshelves that we just retrieve the whole list and then filter here.
    //Might would be a good thing to cache.
    const queryResultElements = useQueryBlorgClass(
        "bookshelf",
        {
            keys: "englishName,key",
            limit: 1000
        },
        // optionally, this group can be limited to the second level shelves of a large project (e.g. Enabling Writers)
        {
            bookShelfCategory: props.bookShelfCategory
        }
    );

    const { noResultsElement, results } = getResultsOrMessageElement(
        queryResultElements
    );
    return (
        noResultsElement || (
            <li
                className={css`
                    margin-top: 30px;
                `}
            >
                <h1>{props.title}</h1>
                <ul
                    className={css`
                        list-style: none;
                        display: flex;
                        padding-left: 0;
                    `}
                >
                    {results
                        .filter(
                            (shelf: any) =>
                                !props.parentBookshelf ||
                                props.parentBookshelf.length == 0 ||
                                shelf.englishName.indexOf(
                                    props.parentBookshelf
                                ) == 0
                        )
                        .map((l: any) => (
                            <CategoryCard
                                title={l.englishName}
                                bookCount="??"
                                filter={{ bookshelf: l.key }}
                                pageType={props.bookShelfCategory}
                            />
                        ))}
                </ul>
            </li>
        )
    );
};
