"use strict"

const canvas = document.getElementById("voting_plot");
const ctx = canvas.getContext("2d");
const size = canvas.width;

function pdf(offset, variance) {
    return Math.exp(-(offset * offset) / (2 * variance * variance)) /
           Math.sqrt(2 * Math.PI * variance * variance);
}

const plurality_voting = {
    vote: (candidates, position) => {
        candidates = candidates.map((c) => Math.abs(c - position));
        const min = Math.min.apply(null, candidates);
        return candidates.map((c) => c === min);
    },

    get_aggregate_obj: (size) => {
        return Array(size).fill(0);
    },

    aggregate_votes: (aggregate, vote, weight) => {
        for (let i = 0; i < aggregate.length; ++i) {
            aggregate[i] += vote[i] * weight;
        }
    },

    sum_votes: (aggregate) => {
        return aggregate.indexOf(Math.max.apply(null, aggregate));
    },
};

const approval_voting = {
    vote: (candidates, position) => {
        candidates = candidates.map((c) => Math.abs(c - position));

        const min = Math.min.apply(null, candidates);
        const max = Math.max.apply(null, candidates);

        if (min === max) {
            return candidates.map((c) => 1 / candidates.length);
        }

        return candidates.map((c) => Math.pow((max - c) / (max - min), 2));
    },

    get_aggregate_obj: (size) => {
        return Array(size).fill(0);
    },

    aggregate_votes: (aggregate, vote, weight) => {
        for (let i = 0; i < aggregate.length; ++i) {
            aggregate[i] += vote[i] * weight;
        }
    },

    sum_votes: (aggregate) => {
        return aggregate.indexOf(Math.max.apply(null, aggregate));
    },
};

const borda_voting = {
    vote: (candidates, position) => {
        candidates = candidates.map((c) => Math.abs(c - position));
        const sorted = candidates.slice().sort();
        return candidates.map((c) => candidates.length - sorted.indexOf(c));
    },

    get_aggregate_obj: (size) => {
        return Array(size).fill(0);
    },

    aggregate_votes: (aggregate, vote, weight) => {
        for (let i = 0; i < aggregate.length; ++i) {
            aggregate[i] += vote[i] * weight;
        }
    },

    sum_votes: (aggregate) => {
        return aggregate.indexOf(Math.max.apply(null, aggregate));
    },
};

const interns = new Map();
function intern(arr) {
    let hash = 0;
    for (let i = 0; i < arr.length; ++i) {
        hash *= arr.length;
        hash += arr[i];
    }

    if (interns.has(hash)) {
        const ret = interns.get(hash);
        for (let i = 0; i < arr.length; ++i) {
            if (ret[i] != arr[i]) {
                throw "Interning failed";
            }
        }
        return ret;
    }

    interns.set(hash, arr);
    return arr;
}

const hare_voting = {
    vote: (candidates, position) => {
        candidates = candidates.map((c) => Math.abs(c - position));
        const sorted = candidates.slice().sort();
        return intern(sorted.map((c) => candidates.indexOf(c)));
    },

    get_aggregate_obj: (size) => {
        return { map: new Map(), size: size };
    },

    aggregate_votes: ({map}, vote, weight) => {
        map.set(vote, (map.get(vote) || 0) + weight);
    },

    sum_votes: (aggregate) => {
        const removed = [];
        const counts = Array(aggregate.size);

        while (true) {
            counts.fill(0);

            for (let [vote, weight] of aggregate.map) {
                for (let candidate of vote) {
                    if (!removed.includes(candidate)) {
                        counts[candidate] += weight;
                        break;
                    }
                }
            }

            let worst = Infinity;
            let worst_index;
            for (let i = 0; i < aggregate.size; ++i) {
                if ((!removed.includes(i)) && (counts[i] < worst)) {
                    worst = counts[i];
                    worst_index = i;
                }
            }
            removed.push(worst_index);

            if (removed.length === aggregate.size - 1) {
                return counts.indexOf(Math.max.apply(null, counts));
            }
        }
    },
};

function redraw(candidates, {vote, get_aggregate_obj, aggregate_votes, sum_votes}, [variance_0, variance_1, weight_1]) {
    const colors = [
        [0xa6, 0xce, 0xe3],
        [0x1f, 0x78, 0xb4],
        [0xb2, 0xdf, 0x8a],
        [0x33, 0xa0, 0x2c],
        [0xfb, 0x9a, 0x99],
        [0xe3, 0x1a, 0x1c],
        [0xfd, 0xbf, 0x6f],
        [0xff, 0x7f, 0x00],
        [0xca, 0xb2, 0xd6],
        [0x6a, 0x3d, 0x9a],
        [0xff, 0xff, 0x99],
        [0xb1, 0x59, 0x28],
    ];

    const votes = Array(size);
    for (let x = 0; x <= size * 3; x++) {
        votes[x] = vote(candidates, x / (size-1) - 1);
    }

    const pdf_cache_0 = Array(size * 3 + 1);
    const pdf_cache_1 = Array(size * 3 + 1);
    for (let p = 0; p <= size * 3; ++p) {
        pdf_cache_0[p] =            pdf(p / size - 1, variance_0);
        pdf_cache_1[p] = weight_1 * pdf(p / size - 1, variance_1);
    }


    var image_data = ctx.getImageData(0, 0, size, size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let vote_sum = get_aggregate_obj(candidates.length);
            for (let p = 0; p <= size * 3; ++p) {
                aggregate_votes(vote_sum, votes[p], (pdf_cache_0[p - y] || 0) + (pdf_cache_1[p - x] || 0));
            }
            const color = colors[sum_votes(vote_sum)];
            image_data.data[y * 4 * size + x * 4 + 0] = color[0];
            image_data.data[y * 4 * size + x * 4 + 1] = color[1];
            image_data.data[y * 4 * size + x * 4 + 2] = color[2];
            image_data.data[y * 4 * size + x * 4 + 3] = 255;
        }
    }

    ctx.putImageData(image_data, 0, 0);
}

let flags = {
    candidates: [0.0, 0.3, 0.5, 1.0],
    system: 'plurality',
    variance_0: 0.2,
    variance_1: 0.2,
    weight_1:   1.0,
};

const systems = {
    plurality: plurality_voting,
    approval: approval_voting,
    borda: borda_voting,
    hare: hare_voting,
}

function update(new_flags) {
    flags = {...flags, ...new_flags};
    redraw(flags.candidates, systems[flags.system], [flags.variance_0, flags.variance_1, flags.weight_1]);
}

update({});
