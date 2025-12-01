import sql from "mssql";

const config = {
    server: "localhost",
    database: "EOSystem",
    user: "sa",
    password: "Akubelajarift1",
    options: {
        trustedConnection: true,
        enableArithAbort: true,
        trustServerCertificate: true,
    },
};

// Connection pool
let poolPromise;

export const connect = () => {
    if(!poolPromise) {
        poolPromise = sql.connect(config);
    }
    return poolPromise;
};

export { sql };

