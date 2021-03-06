import React from 'react';
import http from 'axios';
import GitMatchForm from './form';
import GitMatchResults from './results';
import { GEOCODING, ACCESS_TOKEN, COLORS, STATIC_MAP_ACCESS_TOKEN, STATIC_MAP_URL } from '../../.constants';
import LoadingModal from '../common/loading';
import OverlayModal from '../common/overlay';
import ErrorModal from '../common/error';
import RepoCard from '../common/repocard';
import Logo from '../../img/gitmatch-logo.png';
import subLogo from '../../img/gitmatchlogo.png';
import background from '../../img/background.jpg';
import Scroll from 'react-scroll';
const headers = {
    Authorization: `token ${ACCESS_TOKEN}`,
};
let defaultState = {};
export default class MatchPageComponent extends React.Component {
    constructor(state, context) {
        super(state, context);
        this.state = defaultState = {
            chartData: {
                GitMatchUser: {},
                MatchedUser: {},
            },
            hasError: false,
            errorMessage: '',
            dynamicClass: '',
            percent: 0,
            displayGitUserRepo: false,
            GitUserRepo: {
                topLanguages: undefined,
            },
            displayIndex: 0,
            displayMatchUserRepo: false,
            MatchUserRepo: {
                matchingLanguages: undefined,
            },
            elements: [],
            maxIndex: 0,
            index: 0,
            results: false, // Used to Display Results Div on completion
            loadingText: 'Loading Best Matches', // Text to display what the algorihtm is doing throughout the loading process
            username: '', // Input data, used to search for user
            loading: false, // Used to Display Loading Icons/Dialog/etc
            GitMatchUser: {
                userData: {}, // Object Returned from api.github.com/users/username
                repos: [], // Array Returned from api.github.com/users/username/repos?page=1&page_size=100
                topLanguages: [], // Array of objects in the form of {language:"JavaScript",count:2}, based on how many repos with a spec lang
                uniqueLang: {}, // An Object used to create the topLanguages array in the form of {JavaScript: 3, Shell:4, C#:2};
            },
            MatchingUsers: [
                {
                    userData: {}, // Object Returned from api.github.com/users/username
                    repos: [],
                    matchingLanguages: {},
                    score: 0,
                },
            ],
        };
    }
    // Submit Handler, main function that goes through the logic of finding user and matches
    GitMatch = async event => {
        try {
            this.clearState();
            this.setState({
                loading: true,
                loadingText: 'Retrieving your information',
                percent: 5,
            });
            // Prevent Redirection
            event.preventDefault();

            // Get the users userData and repos
            let userResponse = await this.getUserRepoData(this.state.username);
            this.setState({
                loadingText: 'Validating your location',
                percent: 10,
            });
            // Use Google API to get location
            let locationResponse = await this.getLocation(userResponse.userData.location);
            this.setState({
                loadingText: 'Searching your repos for languages',
                percent: 15,
            });
            // Get Languages to search on
            let languageResponse = await this.getGitMatchUserLanguages(userResponse.repos);
            // Sort Languages by Stars
            languageResponse.topLanguages.sort((a, b) => {
                if (a.count < b.count) {
                    return 1;
                } else if (a.count > b.count) {
                    return -1;
                } else {
                    return 0;
                }
            });
            languageResponse.topLanguages.forEach(topLang => {
                topLang.reposDetails.sort((a, b) => {
                    if (a.stargazers_count < b.stargazers_count) {
                        return 1;
                    } else if (a.stargazers_count > b.stargazers_count) {
                        return -1;
                    } else {
                        return 0;
                    }
                });
            });
            this.setState({
                loadingText: 'Searching for local devs',
                percent: 25,
            });
            let langToken = this.createLanguageToken(languageResponse.topLanguages);
            // Get Matched  Users and Rank them
            let matchUsersResponse = await this.getMatchedUsers(
                locationResponse,
                langToken,
                languageResponse.uniqueLang,
            );
            // Sort Matched Users Repos by Stars
            matchUsersResponse.forEach(user => {
                console.log(user);
                user.matchingLanguages.forEach(langs => {
                    langs.reposDetails.sort((a, b) => {
                        if (a.stargazers_count < b.stargazers_count) {
                            return 1;
                        } else if (a.stargazers_count > b.stargazers_count) {
                            return -1;
                        } else {
                            return 0;
                        }
                    });
                });
            });

            // Filter Out GitMatchUser from Matching Users
            matchUsersResponse = matchUsersResponse.filter(user => {
                return user.userData.login !== userResponse.userData.login;
            });
            this.setState({
                loadingText: 'Generating Language and Repo Charts',
                percent: 35,
            });

            this.genChart(0, matchUsersResponse[0].matchingLanguages, languageResponse.topLanguages);
            this.setState({
                loadingText: 'Stargazing your repos',
                percent: 90,
            });
            // Form an Array to simpify getting stars
            let gitUser = [
                {
                    userData: userResponse.userData,
                    repos: userResponse.repos,
                    stars: userResponse.stars,

                    topLanguages: languageResponse.topLanguages,
                    uniqueLang: languageResponse.uniqueLang,
                },
            ];

            console.log('got stars');
            // Update State and Display New Matches
            this.setState({
                percent: 100,
            });

            setTimeout(() => {
                this.setState({
                    GitMatchUser: gitUser[0],
                    MatchingUsers: matchUsersResponse,
                    maxIndex: matchUsersResponse.length - 2,
                    results: true,
                    loading: false,
                });
                setTimeout(() => {
                    this.scrollTo('resultsScroll');
                }, 500);
            }, 500);
        } catch (err) {
            this.errorHandler(err);
        }
    };
    scrollTo = (element = '', duration = 1500, delay = 100, smooth = 'true', offset = -50) => {
        try {
            let options = {
                duration: duration,
                delay: delay,
                smooth: smooth,
                offset: offset,
            };
            console.log(options);
            Scroll.scroller.scrollTo(element, options);
        } catch (err) {
            throw new Error('Could not scroll to element');
        }
    };
    closeRepoModal = () => {
        this.setState({
            GitUserRepo: { topLanguages: undefined },
            MatchUserRepo: {
                matchingLanguages: undefined,
            },
        });
    };
    clearState = () => {
        defaultState.username = this.state.username;
        this.setState(defaultState);
    };
    changeIndex = (index = 0) => {
        this.setState({
            displayIndex: index,
        });
    };
    bindRefs = (ele, refName) => {
        try {
            debugger;
            if (refName === 'MatchUser') {
                ele.chart_instance.canvas.onclick = function(e, index) {
                    debugger;
                    let activePoints = ele.chart_instance.getElementsAtEvent(e);
                    let firstPoint = activePoints[0];
                    if (firstPoint) {
                        this.setState({
                            GitUserRepo: undefined,
                            displayMatchUserRepo: true,
                            MatchUserRepo: this.state.MatchingUsers[this.state.index],
                            displayIndex: firstPoint._index,
                        });
                    }
                }.bind(this);
            } else if (refName === 'GitMatchUser') {
                ele.chart_instance.canvas.onclick = function(e, index) {
                    debugger;
                    let activePoints = ele.chart_instance.getElementsAtEvent(e);
                    let firstPoint = activePoints[0];
                    if (firstPoint) {
                        this.setState({
                            MatchUserRepo: undefined,
                            displayGitUserRepo: true,
                            GitUserRepo: this.state.GitMatchUser,
                            displayIndex: firstPoint._index,
                        });
                    }
                }.bind(this);
            }
        } catch (err) {
            throw new Error('Could not bind chart references');
        }
    };
    chartClick = ele => {
        try {
            ele.onClick = e => {
                console.log(e);
            };
            if (this.state.elements.length === 1) {
                ele.chart_instance.canvas.onclick = (e, index) => {
                    let activePoints = ele.chart_instance.getElementsAtEvent(e);
                    let firstPoint = activePoints[0];
                    if (firstPoint) {
                        console.log('showing matched users repo');
                        console.log('index', this.state.index, 'user', this.state.MatchingUsers);

                        this.setState({
                            GitUserRepo: undefined,
                            displayMatchUserRepo: true,
                            MatchUserRepo: this.state.MatchingUsers[this.state.index],
                            displayIndex: firstPoint._index,
                        });
                    }
                };
            } else {
                ele.chart_instance.canvas.onclick = (e, index) => {
                    let activePoints = ele.chart_instance.getElementsAtEvent(e);
                    let firstPoint = activePoints[0];
                    if (firstPoint) {
                        this.setState({
                            MatchUserRepo: undefined,
                            displayGitUserRepo: true,
                            GitUserRepo: this.state.GitMatchUser,
                            displayIndex: firstPoint._index,
                        });
                    }
                };
            }
            let newElements = this.state.elements;
            newElements.push(ele.chart_instance.canvas);
            this.setState({
                elements: newElements,
            });
            console.log(this.state.elements);
        } catch (err) {
            throw new Error('Could not generate Charts');
        }
    };
    // Used to update One Specific Users Git-Awards Stars
    getMyStars = async () => {
        try {
            // State Gets Updated Asynchronously, when referencing state in setState, function to use previous state
            this.setState((prevState, props) => ({
                loading: true,
                loadingText: `Updating ${prevState.MatchingUsers[prevState.index].userData.login}'s Star Count`,
            }));
            let user = this.state.MatchingUsers[this.state.index];
            let stateHolder = this.state.MatchingUsers;

            user = await this.getStars(user);
            stateHolder[this.state.index] = user;
            this.setState({
                MatchingUsers: stateHolder,
                loading: false,
            });
        } catch (err) {
            throw new Error('Could not get stars');
        }
    };
    getStars = async user => {
        try {
            this.setState({ percent: 25 });
            setTimeout(() => {
                this.setState({ percent: 75 });
                setTimeout(() => {
                    this.setState({ percent: 90 });
                }, 300);
            }, 500);

            let starsResponse = await http
                .get(`https://crossorigin.me/http://git-awards.com/api/v0/users/${user.userData.login}`)
                .then(
                    response => {
                        let stars = 0;
                        console.log(stars);
                        response.data.user.rankings.forEach(rank => {
                            stars += rank.stars_count;
                        });
                        console.log('This is a response', response);
                        return stars;
                    },
                    error => {
                        throw 'error';
                    },
                );
            this.setState({ percent: 100 });
            user.stars = starsResponse;
            return user;
        } catch (err) {
            throw new Error('Could not get stars');
        }
    };
    errorHandler = error => {
        console.log(error);
        this.setState({
            loading: false,
            hasError: true,
            errorMessage: error.message,
        });
    };
    nextMatch = () => {
        debugger;
        if (this.state.index < this.state.MatchingUsers.length - 2) {
            this.genChart(
                this.state.index + 1,
                this.state.MatchingUsers[this.state.index + 1].matchingLanguages,
                this.state.GitMatchUser.topLanguages,
            );
        }
        this.setState((prevState, props) => ({
            index: this.state.index + 1,
        }));
        console.log(this.state);
    };
    previousMatch = () => {
        try {
            if (this.state.index > 0) {
                this.genChart(
                    this.state.index - 1,
                    this.state.MatchingUsers[this.state.index - 1].matchingLanguages,
                    this.state.GitMatchUser.topLanguages,
                );
            }
            this.setState((prevState, props) => ({
                index: prevState.index + 1,
            }));
        } catch (err) {
            throw new Error('Could not get previous match');
        }
    };
    genChart = (index, gitmatchdata, gituserdata) => {
        this.setState({
            loadingText: `${index}, ${gitmatchdata}, ${gituserdata}`,
        });
        let gituserdatas = [];
        let gitusercolors = [];
        let gitmatchdatas = [];
        let gitmatchcolors = [];
        let gitmatchlabels = [];
        let gituserlabels = [];
        // Gen GitUser Chart
        gituserdata.forEach(d => {
            gituserdatas.push(d.count);
            gitusercolors.push(COLORS[d.language].color);
            gituserlabels.push(d.language);
        });

        // Gen GitMatch Chart
        gitmatchdata.forEach(d => {
            gitmatchdatas.push(d.count);
            gitmatchcolors.push(COLORS[d.language].color);
            gitmatchlabels.push(d.language);
        });

        if (gituserdata.length === 0) {
            this.setState({
                percent: 80,
                loadingText: 'gen first chart',
                chartData: {
                    GitMatchUser: this.state.chartData.GitMatchUser,
                    MatchedUser: {
                        data: {
                            labels: gitmatchlabels,
                            datasets: [
                                {
                                    label: 'My First dataset',
                                    data: gitmatchdatas,
                                    backgroundColor: gitmatchcolors,
                                },
                            ],
                        },
                        options: {
                            onClick: function(e) {
                                console.log(e);
                            },
                            responsive: true,
                            maintainAspectRatio: true,
                        },
                    },
                },
                index: index,
            });
        } else {
            this.setState({
                percent: 85,
                chartData: {
                    GitMatchUser: {
                        data: {
                            labels: gituserlabels,
                            datasets: [
                                {
                                    label: 'My First dataset',
                                    data: gituserdatas,
                                    backgroundColor: gitusercolors,
                                },
                            ],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                        },
                    },
                    MatchedUser: {
                        data: {
                            labels: gitmatchlabels,
                            datasets: [
                                {
                                    label: 'My First dataset',
                                    data: gitmatchdatas,
                                    backgroundColor: gitmatchcolors,
                                },
                            ],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                        },
                    },
                },
            });
        }
    };
    // Async Function that searchs github for users based on location and specific languages
    getMatchedUsers = async (location, languageToken, uniqueLang) => {
        try {
            let promises = [];
            let usersResponse = await http.get(
                `https://api.github.com/search/users?q=location:${this.encode(
                    location,
                )}${languageToken}&page=1&per_page=100`,
                { headers: headers },
            );
            // Create usersData array of user objects form of {userData:{},repos:{}}
            debugger;
            promises = usersResponse.data.items.map((user, index) =>
                this.getUserRepoData(user.login, index).then(newResponse => {
                    return newResponse;
                }),
            );
            debugger;
            let usersData = await Promise.all(promises);
            debugger;
            // for (let promise of promises) {
            // 	let val = await promise;
            // 	usersData.push(val);
            // }
            // Wait for All HTTP requests to finish before parsing the usersData array to create matching Languages and scores for each User
            console.log('Users Data', usersData);
            // Parse array to create a Score for each user
            this.setState({
                loadingText: 'Calculating Match Score',
                percent: 20,
            });
            usersData.forEach(data => {
                console.log('UserData Data', data);
                let repoScore = 0;
                let reposHolder = {};
                data.matchingLanguages = {};
                data.repos.forEach(repo => {
                    if (uniqueLang[repo.language] !== undefined && repo.language !== null) {
                        // Check to see if this language has been used to calc repo score
                        // This algorihthm takes into account Unique Languages and matching top languages
                        if (data.matchingLanguages[repo.language] === undefined) {
                            reposHolder[repo.language] = [];
                            // if it hasn't give a weighted score for a newly matched language (weighted heavier than each additional repo lang)
                            repoScore = repoScore + uniqueLang[repo.language] * 100;
                            data.matchingLanguages[repo.language] = 1;
                            // if it has, give a slightly less weighted score
                        } else {
                            repoScore = repoScore + 1 * uniqueLang[repo.language];
                            data.matchingLanguages[repo.language] = data.matchingLanguages[repo.language] + 1;
                        }

                        reposHolder[repo.language].push(repo);
                    }
                });

                // Level the score with a natural log and multiply by the gitmatch factor and floor it to a nice integer
                data.score = Math.floor(Math.log(repoScore) * 10.1231234113);
                let matchingLanguagesHolder = [];
                for (var key in data.matchingLanguages) {
                    // skip loop if the property is from prototype
                    if (!data.matchingLanguages.hasOwnProperty(key)) continue;
                    matchingLanguagesHolder.push({
                        language: key,
                        count: data.matchingLanguages[key],
                        reposDetails: reposHolder[key],
                    });
                }
                // Create a matchingLanguages property on matchedUsers object and give the value of the array of matchingLanguages
                data.matchingLanguages = matchingLanguagesHolder;
                // Sort the matching Languages array in descending order
                data.matchingLanguages.sort((a, b) => {
                    if (a.count < b.count) {
                        return 1;
                    } else if (a.count > b.count) {
                        return -1;
                    } else {
                        return 0;
                    }
                });
            });
            usersData.sort((a, b) => {
                if (a.score < b.score) {
                    return 1;
                } else if (a.score > b.score) {
                    return -1;
                } else {
                    return 0;
                }
            });
            return usersData;
        } catch (err) {
            throw new Error('Could not retrieve matching users');
        }
        // Finally sort the array of matchedUser objects in descending order by score
    };

    // Function to create a language token for use with the github api search for top users
    createLanguageToken = languages => {
        try {
            // create an empty token
            let languageToken = '';
            // then append each unique language to the token, encoding the language, so that
            // languages such as 'C#' or 'C++' dont get viewed as if it were 'C',
            // additionally this encoding prevents the need to parse multi word languages with a dash
            languages.forEach(language => {
                languageToken += `+language:${this.encode(language.language)}`;
            });
            return languageToken;
        } catch (err) {
            throw new Error('Could Not create language token');
        }
    };
    // Find unique languages for the GitMatchUser, (person searching)
    getGitMatchUserLanguages = async repos => {
        try {
            let topLanguages = [];
            let uniqueLang = {};
            let reposHolder = {};
            // Loop through repos to create a uniqelanguage object to parse into an array
            repos.forEach(repo => {
                if (repo.language !== undefined) {
                    if (uniqueLang[repo.language] === undefined && repo.language !== null) {
                        reposHolder[repo.language] = [];

                        uniqueLang[repo.language] = 1;
                    } else if (repo.language !== null) {
                        uniqueLang[repo.language]++;
                    }
                    if (repo.language !== null) {
                        reposHolder[repo.language].push(repo);
                    }
                }
            });
            // Loop through Object to create Top Language Array
            for (var key in uniqueLang) {
                // skip loop if the property is from prototype
                if (!uniqueLang.hasOwnProperty(key)) continue;
                topLanguages.push({
                    language: key,
                    count: uniqueLang[key],
                    reposDetails: reposHolder[key],
                });
            }
            //Sort Langauges array descending from most to least
            topLanguages.sort((a, b) => {
                if (a.count < b.count) {
                    return 1;
                } else if (a.count > b.count) {
                    return -1;
                } else {
                    return 0;
                }
            });
            // Return Top Languages and uniqueLanges
            return {
                topLanguages,
                uniqueLang,
            };
        } catch (err) {
            throw new Error('Could not get Matched Users Languages');
        }
    };
    // Async function that gets userdata and repo data for each username
    getUserRepoData = async (username, index = 0) => {
        try {
            // Get UserData, and wait for it to return before getting repos
            let starsResponse = false;
            let userResponse = await http.get(`https://api.github.com/users/${username}`, {
                headers: headers,
            });

            // await promise to resolve
            let reposResponse = await http.get(`https://api.github.com/users/${username}/repos?page=1&per_page=100`, {
                headers: headers,
            });
            //This needs rework as it doesn't get the top 5 stars, but the top 5 users from the initial git request
            if (index < 0) {
                starsResponse = await http
                    .get(`https://crossorigin.me/http://git-awards.com/api/v0/users/${username}`)
                    .then(response => {
                        let stars = 0;
                        response.data.user.rankings.forEach(rank => {
                            stars += rank.stars_count;
                        });
                        return stars;
                    })
                    .catch(err => {
                        return false;
                    });
            }
            return {
                userData: userResponse.data,
                repos: reposResponse.data,
                stars: starsResponse,
            };
        } catch (err) {
            throw new Error('Could not get users repo data');
        }
    };
    // Encode function to encode str to URI component
    encode = str => {
        try {
            return encodeURIComponent(str);
        } catch (err) {
            this.errorHandler(new Error("Outdated Browser and doesn't support needed features"));
        }
    };
    // Use google API to get correct
    getLocation = async location => {
        try {
            // Encode location to lowercase, no longer need to parse location if multiword location
            location = this.encode(location.toLowerCase());

            // await reponse, then return decided value
            let response = await http.get(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${location}&key=${GEOCODING}`,
            );
            console.log(response);
            let loca = response.data.results[0].address_components[0].short_name.toLowerCase();
            console.log(loca);
            this.setState({
                background: `${STATIC_MAP_URL}center=${this.encode(loca)
                    ? this.encode(loca)
                    : this.encode(
                          'los angeles',
                      )}&size=640x640&style=element:labels|visibility:off&style=element:geometry.stroke|visibility:off&style=feature:landscape|element:geometry|saturation:-100&style=feature:water|saturation:-100|invert_lightness:true&key=${STATIC_MAP_ACCESS_TOKEN}`,
            });
            return loca;
        } catch (err) {
            throw new Error('Could not get location');
        }
    };
    // Handles each input on the form and sets it to state
    input = event => {
        this.setState({
            username: event.target.value,
        });
    };
    // Allows for full text highlighting on a single click
    select = event => {
        event.target.select();
    };
    setClass = () => {
        this.setState({
            dynamicClass: 'search-bar',
        });
    };
    unsetClass = () => {
        this.setState({
            dynamicClass: '',
        });
    };
    render() {
        return (
            <div>
                <GitMatchForm
                    style={{ height: '100vh' }}
                    submit={this.GitMatch}
                    title={'Git Matched with Local Devs instantly'}
                    select={this.select}
                    onInput={this.input}
                    image={Logo}
                    subImage={subLogo}
                    input={this.state.username}
                    background={background}
                    dynamicClass={this.state.dynamicClass}
                />
                <br />
                <GitMatchResults
                    nextMatch={this.nextMatch}
                    previousMatch={this.previousMatch}
                    maxIndex={this.state.maxIndex}
                    index={this.state.index}
                    GitMatchUser={this.state.GitMatchUser}
                    results={this.state.results}
                    loading={this.state.loading}
                    MatchingUsers={this.state.MatchingUsers}
                    chartData={this.state.chartData}
                    getMyStars={this.getMyStars}
                    bindRef={this.bindRefs}
                    setClass={this.setClass}
                    unsetClass={this.unsetClass}
                    background={this.state.background}
                />
                <RepoCard
                    user={this.state.GitUserRepo || this.state.MatchUserRepo}
                    close={this.closeRepoModal}
                    index={this.state.displayIndex}
                    changeIndex={this.changeIndex}
                />
                <ErrorModal error={this.state.hasError} text={this.state.errorMessage} />
                <LoadingModal loading={this.state.loading} text={this.state.loadingText} percent={this.state.percent} />
                <OverlayModal loading={this.state.loading} />
            </div>
        );
    }
}
