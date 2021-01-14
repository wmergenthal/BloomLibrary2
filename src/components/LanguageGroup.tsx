// this engages a babel macro that does cool emotion stuff (like source maps). See https://emotion.sh/docs/babel-macros
import css from "@emotion/css/macro";
// these two lines make the css prop work on react elements
import { jsx } from "@emotion/core";
/** @jsx jsx */

import React, { useContext, useState } from "react";
import { LanguageCard } from "./LanguageCard";
import Downshift, {
    GetItemPropsOptions,
    GetMenuPropsOptions,
    GetRootPropsOptions,
} from "downshift";
import matchSorter from "match-sorter";
import searchIcon from "../search.png";
import { CachedTablesContext } from "../model/CacheProvider";
import { ILanguage } from "../model/Language";
import { CardSwiperLazy } from "./CardSwiper";
import { Redirect } from "react-router-dom";
import { FormattedMessage, useIntl } from "react-intl";
import { propsToHideAccessibilityElement } from "../Utilities";
import { useResponsiveChoice } from "../responsiveUtilities";

export const LanguageGroup: React.FunctionComponent = () => {
    const l10n = useIntl();
    const { languagesByBookCount: languages } = useContext(CachedTablesContext);
    // setting this to a language code causes a <Redirect> to render and open the page
    // for that code (currently when the user has selected a language by typing and pressing Enter)
    const [langChosen, setLangChosen] = useState("");
    const getResponsiveChoice = useResponsiveChoice();
    let filteredLanguages: ILanguage[] = [];

    const getFilteredLanguages = (filter: string | null): ILanguage[] => {
        // MatchSorter is an npm module that does smart autocomplete over a list of values.
        return matchSorter(languages, filter || "", {
            keys: ["englishName", "name", "isoCode"],
        });
    };
    const getFilterLanguagesUI = (
        filter: string | null,
        getItemProps: (options: GetItemPropsOptions<any>) => {},
        getMenuProps: (options: GetMenuPropsOptions) => {}
    ) => {
        filteredLanguages = getFilteredLanguages(filter);
        if (filteredLanguages.length) {
            return (
                <div {...getMenuProps({})}>
                    <CardSwiperLazy
                        data={filteredLanguages}
                        getReactElement={(l: ILanguage, index: number) => (
                            // JohnT: I think this comment is wrong; getLabelProps is actually to do with a label for
                            // the whole chooser.
                            // TODO: to complete the accessibility, we need to pass the Downshift getLabelProps into LanguageCard
                            // and apply it to the actual label.
                            <LanguageCard
                                {...getItemProps({ item: l })}
                                key={index}
                                name={l.name}
                                englishName={l.englishName}
                                usageCount={l.usageCount}
                                isoCode={l.isoCode}
                                objectId={l.objectId}
                                role="option"
                            />
                        )}
                    />
                </div>
            );
        } else {
            return (
                <div
                    css={css`
                        padding-top: 10px;
                        font-size: 0.8rem;
                    `}
                >
                    <FormattedMessage
                        id="noLanguageMatch"
                        defaultMessage="We could not find any book with languages matching {searchString}"
                        values={{ searchString: filter }}
                    />
                </div>
            );
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            if (filteredLanguages.length) {
                setLangChosen(filteredLanguages[0].isoCode);
            }
        }
    };
    // This is working around the fact that our typedefs do not know that GetRootPropsOptions
    // is allowed to have a role property. The effect is to prevent the root div that contains
    // the type-ahead box getting the combobox role and related aria declarations that cause
    // NVDA to skip it in browse mode (no, I don't know why it would skip combo boxes!  )
    const rootPropsOptions: GetRootPropsOptions = { refKey: "ref" };
    (rootPropsOptions as any).role = undefined;

    const contentHeight = getResponsiveChoice(140, 160);

    return langChosen ? (
        <Redirect to={"/language:" + langChosen} />
    ) : (
        <li role="region" aria-labelledby="findBooksByLanguage">
            <h1
                // This has an ID to match the aria-labelledby above.
                // The FormattedMessage has an ID to look up the message, but its ID does not
                // appear in the generated document so there is no confusion.
                id="findBooksByLanguage"
            >
                <FormattedMessage
                    id="findBooksByLanguage"
                    defaultMessage="Find Books By Language"
                />
            </h1>

            {(languages.length && (
                /* Downshift handles telling us when to recompute the list of matching items.
                It also claims to present it all in a WAI-ARIA compliant accessible way (untested).
                We give it a function that returns a react element that contains the
                list of matching cards, and it calls that function on every keystroke. */
                <Downshift
                    getA11yStatusMessage={({ resultCount }) =>
                        resultCount
                            ? `${resultCount} results. Use tab and shift-tab to navigate`
                            : "No results found"
                    }
                    defaultIsOpen={true}
                >
                    {({
                        getInputProps,
                        getLabelProps,
                        getItemProps,
                        getRootProps,
                        getMenuProps,
                        inputValue: currentInputBoxText,
                    }) => (
                        <div
                            css={css`
                                height: ${contentHeight}px;
                            `}
                        >
                            <div
                                css={css`
                                    display: flex;
                                    margin-bottom: 2px;
                                    height: 32px;
                                `}
                                {...getRootProps(rootPropsOptions)}
                            >
                                <div
                                    css={css`
                                        display: flex;
                                        border: 1px solid #ccc;
                                        border-radius: 5px;
                                        padding-left: 5px;
                                        margin-right: 10px;
                                        height: 26px;
                                    `}
                                >
                                    <div
                                        // downshift insists there must be a label. We don't want to see it, but do want a screen
                                        // reader to find it, so hide it off screen.
                                        css={css`
                                            ${propsToHideAccessibilityElement}
                                        `}
                                        {...getLabelProps()}
                                    >
                                        enter partial language name
                                    </div>
                                    <input
                                        css={css`
                                            display: block;
                                            border: 0;
                                            // Inputs smaller than 16pt cause Safari on IOS to zoom in (BL-9204), messing up our
                                            // responsive web site by making it wider than the display.
                                            // It would be better if there was a way to say "at least 16px" in case
                                            // some user has extra-large fonts configured, but I don't know a reliable
                                            // way to do it.
                                            font-size: 16px;
                                        `}
                                        {...getInputProps({
                                            onKeyPress: (e) =>
                                                handleKeyPress(e),
                                        })}
                                        onBlur={() => {
                                            // Overridden.
                                            // Otherwise, the filtered list of cards reverts
                                            // to unfiltered BEFORE the click event, with the result
                                            // that the wrong card is selected.
                                        }}
                                    />
                                    <img
                                        src={searchIcon}
                                        alt={l10n.formatMessage({
                                            id: "search",
                                            defaultMessage: "Search",
                                        })}
                                    />
                                </div>

                                <div
                                    css={css`
                                        margin-top: 4px;
                                    `}
                                >
                                    <FormattedMessage
                                        id="languagesCount"
                                        defaultMessage="{count} Languages"
                                        values={{ count: languages.length }}
                                    />
                                </div>
                            </div>
                            {getFilterLanguagesUI(
                                currentInputBoxText,
                                getItemProps,
                                getMenuProps
                            )}
                        </div>
                    )}
                </Downshift>
            )) || (
                // still loading or no response
                <div
                    css={css`
                        height: ${contentHeight}px;
                    `}
                >
                    <FormattedMessage
                        id="loading"
                        defaultMessage="Loading..."
                    />
                </div>
            )}
        </li>
    );
};
