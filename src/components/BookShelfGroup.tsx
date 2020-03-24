// this engages a babel macro that does cool emotion stuff (like source maps). See https://emotion.sh/docs/babel-macros
import css from "@emotion/css/macro";
// these two lines make the css prop work on react elements
import { jsx } from "@emotion/core";
/** @jsx jsx */
import React, { useContext } from "react";
import { useGetBookshelvesByCategory } from "../connection/LibraryQueryHooks";
import CategoryCard from "./CategoryCard";
import LazyLoad from "react-lazyload";
import { Bookshelf } from "../model/Bookshelf";
import { CachedTablesContext } from "../App";

const encodeUrl = require("encodeurl");
interface IProps {
    title: string;
    bookShelfCategory: string; // project, org, publisher, custom
    // The part of the bookshelf "path" leading up to the current page. E.g. "Enabling Writers Workshops/"
    pathToTheCurrentLevel?: string;
}
/* This lets us show bookshelves. Not the books in them, but the list of shelves, themselves.
    It's not obvious that we want/need the current system with bookshelves which live in the database.
    On the one hand, we may find we need to do code work anyhow to do a good job of presenting a shelf,
    so why not just locate it in the code.

    On the other hand, we will eventually need to support user-generated shelves. We may also eventually
    need to support alternate book library sites, and those would be even more driven by database
    instead of code.

    So for the moment, I'm just leaving things as they are. We can query for all bookshelves, but the
    home page will also choose to feature Enabling writers, from code. So it's a mix of approaches
    for now.
*/

export const BookshelfGroup: React.FunctionComponent<IProps> = props => (
    // Enhance: LazyLoad has parameters (height and offset) that should help
    // but so far I haven't got them to work well. It has many other
    // parameters too that someone should look into. Make sure to test
    // with the phone sizes in the browser debugger, and have the network
    // tab open, set to "XHR". That will show you when a new query happens
    // because this has loaded a new BookGroupInner.
    // If the params are good, this list will grow as you scroll.
    // If the params are bad, some groups at the end will NEVER show.

    /* Note, this currently breaks strict mode. See app.tsx */
    <LazyLoad height={258 /* todo derive from commonui.something */}>
        <BookshelfGroupInner {...props} />
    </LazyLoad>
);

// Normally the bookshelf name matches the image name, but if not we change it here:
const nameToImageMap = new Map<string, string>([
    //  // something in our pipeline won't deliver an image that starts with "3"
    ["3Asafeer", "Asafeer"],
    ["Room To Read", "Room to Read"],
    ["Ministerio de Educación de Guatemala", "Guatemala MOE"],
    ["Resources for the Blind, Inc. (Philippines)", "Resources for the Blind"]
]);

export const BookshelfGroupInner: React.FunctionComponent<IProps> = props => {
    // At this point there are so few bookshelves that we just retrieve the whole list and then filter here.
    // Might be a good thing to cache.
    const bookshelfResults = useGetBookshelvesByCategory(
        props.bookShelfCategory
    );

    // Bookshelves are hierarchical, and use slashes to convey the full path.
    // We only display one level at a time. At each level, we want to show cards
    // for all the "children" of the current level.
    // E.g. if we are at art/ we might have [art/painting/impressionists, art/painting/cubists, art/sculpture].
    // From that we need to determine that on this level, we should be showing [painting, sculpture].

    const bookshelfPathsAtThisLevel = props.pathToTheCurrentLevel
        ? bookshelfResults.filter(b =>
              b.key.startsWith(props.pathToTheCurrentLevel!)
          )
        : bookshelfResults;

    const prefix: string = props.pathToTheCurrentLevel || "";
    const allNamesAtThisLevel = bookshelfPathsAtThisLevel
        .map(b => b.key.replace(prefix, ""))
        .map(name => {
            const i = name.indexOf("/");
            return i < 0 ? name : name.substr(0, i);
        });

    const uniqueNamesAtThisLevel = [
        ...Array.from(new Set(allNamesAtThisLevel))
    ];

    const { bookshelves } = useContext(CachedTablesContext);

    const cards =
        bookshelfResults &&
        uniqueNamesAtThisLevel.map((nextLevel: string) => {
            const imageName = nameToImageMap.get(nextLevel) ?? nextLevel;
            // note, this will often be the *start* of an actual bookshelf path, e.g. "Enabling Writers Workshops/"
            const fullBookshelfKey =
                (props.pathToTheCurrentLevel || "") + nextLevel;
            const bookshelf = Bookshelf.parseBookshelfKey(
                fullBookshelfKey,
                bookshelves
            );
            return (
                <CategoryCard
                    key={fullBookshelfKey}
                    preTitle={bookshelf.countryDisplayName}
                    title={bookshelf.displayName || ""}
                    bookCount="??"
                    filter={{
                        bookshelf: fullBookshelfKey
                    }}
                    pageType={props.bookShelfCategory}
                    img={
                        "https://share.bloomlibrary.org/bookshelf-images/" +
                        encodeUrl(imageName) +
                        ".png"
                    }
                />
            );
        });

    return (
        <li
            css={css`
                margin-top: 30px;
            `}
        >
            <h1>{props.title}</h1>
            <ul
                css={css`
                    list-style: none;
                    display: flex;
                    padding-left: 0;
                `}
            >
                {cards}
            </ul>
        </li>
    );
};
