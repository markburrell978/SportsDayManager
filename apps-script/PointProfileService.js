/**
 * ==========================================================
 * Sports Day Manager
 *
 * Point Profile Service
 *
 * Owns one-row point profiles and legacy profile migration.
 * ==========================================================
 */

const POINT_PROFILE_HEADERS = Object.freeze([
    "ID",
    "Name",
    "First",
    "Second",
    "Third",
    "Fourth"
]);


const PointProfileService = {

    getAll() {

        this.ensureCurrentSchema();


        const profiles =
            Database
                .get(TABLES.POINT_PROFILES)
                .map(profile =>
                    this.normaliseProfile(profile)
                );


        this.validateUniqueIds(profiles);


        return profiles;

    },


    getById(id) {

        if (!id) {

            return null;

        }


        return this.getAll()
            .find(profile => profile.ID === id) ||
            null;

    },


    create(profile) {

        const normalised =
            this.validateAndNormalise(profile, true);


        this.ensureCurrentSchema();

        const lock =
            LockService.getScriptLock();


        lock.waitLock(30000);


        try {


            if (this.getById(normalised.ID)) {

                throw new Error(
                    `A point profile with ID ${normalised.ID} already exists.`
                );

            }


            Database.insert(
                TABLES.POINT_PROFILES,
                normalised
            );


            return normalised;

        }
        finally {

            lock.releaseLock();

        }

    },


    update(profile) {

        const normalised =
            this.validateAndNormalise(profile, true);

        const existing =
            this.getById(normalised.ID);


        if (!existing) {

            throw new Error(
                "Point profile not found."
            );

        }


        if (
            !Database.update(
                TABLES.POINT_PROFILES,
                normalised.ID,
                normalised
            )
        ) {

            throw new Error(
                "Point profile could not be updated."
            );

        }


        return normalised;

    },


    ensureCurrentSchema() {

        const headers =
            Database.getHeaders(
                TABLES.POINT_PROFILES
            );


        if (
            headers.length === POINT_PROFILE_HEADERS.length &&
            POINT_PROFILE_HEADERS.every(
                (header, index) =>
                    headers[index] === header
            )
        ) {

            return;

        }


        const lock =
            LockService.getScriptLock();


        lock.waitLock(30000);


        try {

            const lockedHeaders =
                Database.getHeaders(
                    TABLES.POINT_PROFILES
                );


            if (
                lockedHeaders.length === POINT_PROFILE_HEADERS.length &&
                POINT_PROFILE_HEADERS.every(
                    (header, index) =>
                        lockedHeaders[index] === header
                )
            ) {

                return;

            }


            this.migrateSchema(lockedHeaders);

        }
        finally {

            lock.releaseLock();

        }

    },


    migrateSchema(headers) {

        if (
            !headers.length ||
            headers.every(header => Utils.isBlank(header))
        ) {

            Database.replaceAll(
                TABLES.POINT_PROFILES,
                POINT_PROFILE_HEADERS,
                []
            );


            return;

        }


        const hasNewColumns =
            POINT_PROFILE_HEADERS.every(header =>
                headers.includes(header)
            );


        if (hasNewColumns) {

            const profiles =
                Database
                    .get(TABLES.POINT_PROFILES)
                    .map(profile =>
                        this.validateAndNormalise(
                            profile,
                            true
                        )
                    );


            this.validateUniqueIds(profiles);

            Database.replaceAll(
                TABLES.POINT_PROFILES,
                POINT_PROFILE_HEADERS,
                profiles
            );


            return;

        }


        this.migrateLegacySchema(headers);

    },


    migrateLegacySchema(headers) {

        const idHeader = headers.includes("ProfileID")
            ? "ProfileID"
            : headers.includes("ID")
                ? "ID"
                : null;


        if (
            !idHeader ||
            !headers.includes("Position") ||
            !headers.includes("Points")
        ) {

            throw new Error(
                "PointProfiles must use either the legacy ID/ProfileID, Position, Points columns or the new ID, Name, First, Second, Third, Fourth columns."
            );

        }


        const rows =
            Database.get(TABLES.POINT_PROFILES);

        const grouped = {};


        rows.forEach(row => {

            const id =
                String(row[idHeader] || "").trim();

            const name =
                String(row.Name || "").trim();

            const position =
                Number(row.Position);

            const points =
                Number(row.Points);


            if (!id) {

                throw new Error(
                    "A legacy point-profile row is missing its profile ID."
                );

            }


            if (
                !Number.isInteger(position) ||
                position < 1 ||
                position > 4
            ) {

                throw new Error(
                    `Point profile ${id} contains unsupported position ${row.Position}.`
                );

            }


            if (
                Utils.isBlank(row.Points) ||
                !Number.isInteger(points)
            ) {

                throw new Error(
                    `Point profile ${id} position ${position} must contain integer points.`
                );

            }


            if (!grouped[id]) {

                grouped[id] = {
                    ID: id,
                    Name: name || id,
                    positions: {}
                };

            }


            if (
                name &&
                grouped[id].Name !== id &&
                grouped[id].Name !== name
            ) {

                throw new Error(
                    `Point profile ${id} contains conflicting names.`
                );

            }


            if (name && grouped[id].Name === id) {

                grouped[id].Name = name;

            }


            if (grouped[id].positions.hasOwnProperty(position)) {

                throw new Error(
                    `Point profile ${id} contains duplicate position ${position}.`
                );

            }


            grouped[id].positions[position] = points;

        });


        const profiles =
            Object.values(grouped)
                .map(group => ({
                    ID: group.ID,
                    Name: group.Name,
                    First: group.positions[1] ?? 0,
                    Second: group.positions[2] ?? 0,
                    Third: group.positions[3] ?? 0,
                    Fourth: group.positions[4] ?? 0
                }));


        Database.replaceAll(
            TABLES.POINT_PROFILES,
            POINT_PROFILE_HEADERS,
            profiles
        );

    },


    validateAndNormalise(profile, requireId) {

        const id = String(
            profile.ID ??
            profile.id ??
            ""
        ).trim();

        const name = String(
            profile.Name ??
            profile.name ??
            ""
        ).trim();


        if (requireId && !id) {

            throw new Error(
                "Point profile ID is required."
            );

        }


        if (!name) {

            throw new Error(
                "Point profile name is required."
            );

        }


        return {
            ID: id,
            Name: name,
            First: this.normalisePoints(
                profile.First ?? profile.first,
                "First-place"
            ),
            Second: this.normalisePoints(
                profile.Second ?? profile.second,
                "Second-place"
            ),
            Third: this.normalisePoints(
                profile.Third ?? profile.third,
                "Third-place"
            ),
            Fourth: this.normalisePoints(
                profile.Fourth ?? profile.fourth,
                "Fourth-place"
            )
        };

    },


    normalisePoints(value, label) {

        if (Utils.isBlank(value)) {

            throw new Error(
                `${label} points are required.`
            );

        }


        const points = Number(value);


        if (!Number.isInteger(points)) {

            throw new Error(
                `${label} points must be an integer.`
            );

        }


        return points;

    },


    normaliseProfile(profile) {

        return this.validateAndNormalise(
            profile,
            true
        );

    },


    validateUniqueIds(profiles) {

        const ids = profiles.map(profile => profile.ID);


        if (new Set(ids).size !== ids.length) {

            throw new Error(
                "PointProfiles contains duplicate profile IDs."
            );

        }

    }

};
