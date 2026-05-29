local ok_logger, logger = pcall(require, "logger")
local ok_http, http = pcall(require, "http")
local ok_cjson, cjson = pcall(require, "cjson")

local function log(level, msg)
    if ok_logger and logger[level] then
        pcall(logger[level], logger, msg)
    end
end

local function encode_json(value)
    if ok_cjson then
        local ok, result = pcall(cjson.encode, value)
        if ok then return result end
    end
    local function serialize(v)
        if type(v) == "string" then return string.format("%q", v) end
        if type(v) == "number" then return tostring(v) end
        if type(v) == "boolean" then return v and "true" or "false" end
        if type(v) == "table" then
            local parts = {}
            for key, val in pairs(v) do
                table.insert(parts, string.format("%s:%s", serialize(tostring(key)), serialize(val)))
            end
            return "{" .. table.concat(parts, ",") .. "}"
        end
        return "null"
    end
    return serialize(value)
end

local function get_plugin_dir()
    local source = debug.getinfo(1).source or ""
    if source:sub(1, 1) == "@" then
        source = source:sub(2)
    end
    source = source:gsub("\\", "/")
    local parts = {}
    for part in source:gmatch("[^/]+") do
        table.insert(parts, part)
    end
    table.remove(parts)
    table.remove(parts)
    return table.concat(parts, "/")
end

function install_update(params)
    log("info", "install_update called")

    if not ok_http then
        log("error", "http module unavailable")
        return encode_json({ success = false, error = "http module unavailable" })
    end

    local url = params and params.url
    if not url or url == "" then
        log("error", "missing url parameter")
        return encode_json({ success = false, error = "missing url" })
    end

    local plugin_dir = get_plugin_dir()
    if not plugin_dir or plugin_dir == "" then
        log("error", "could not determine plugin directory")
        return encode_json({ success = false, error = "plugin dir detection failed" })
    end

    local plugins_dir = plugin_dir:match("^(.+)/[^/]+$") or ""
    local temp_zip = plugin_dir .. "/update.zip"

    log("info", "downloading update from " .. url)

    local ok, response = pcall(http.get, url)
    if not ok then
        log("error", "download exception: " .. tostring(response))
        return encode_json({ success = false, error = "download exception" })
    end

    local body
    if type(response) == "table" then
        if response.status and response.status ~= 200 then
            log("error", "http status " .. tostring(response.status))
            return encode_json({ success = false, error = "http " .. tostring(response.status) })
        end
        body = response.body
    else
        body = tostring(response)
    end

    if not body or #body == 0 then
        log("error", "empty download body")
        return encode_json({ success = false, error = "empty response" })
    end

    log("info", "writing temp zip " .. temp_zip .. " (" .. tostring(#body) .. " bytes)")

    local file, write_err = io.open(temp_zip, "wb")
    if not file then
        log("error", "temp file open failed: " .. tostring(write_err))
        return encode_json({ success = false, error = "cannot write temp file" })
    end
    file:write(body)
    file:close()

    log("info", "extracting to " .. plugins_dir)

    local ps_cmd = string.format(
        'powershell -NoProfile -Command "Expand-Archive -Path ''%s'' -DestinationPath ''%s'' -Force"',
        temp_zip:gsub("'", "''"),
        plugins_dir:gsub("'", "''")
    )

    local exec_ok, exec_a, exec_b, exec_c = pcall(os.execute, ps_cmd)
    if not exec_ok then
        pcall(function() os.remove(temp_zip) end)
        log("error", "powershell execution failed: " .. tostring(exec_a))
        return encode_json({ success = false, error = "powershell execution failed" })
    end

    local succeeded = false
    if type(exec_a) == "boolean" then
        succeeded = exec_a == true and exec_b == "exit" and (exec_c == 0 or exec_c == nil)
    elseif type(exec_a) == "number" then
        succeeded = exec_a == 0
    end

    if not succeeded then
        pcall(function() os.remove(temp_zip) end)
        log("error", "extract failed (a=" .. tostring(exec_a) .. " b=" .. tostring(exec_b) .. " c=" .. tostring(exec_c) .. ")")
        return encode_json({ success = false, error = "extract failed" })
    end

    pcall(function() os.remove(temp_zip) end)
    log("info", "update installed successfully")
    return encode_json({ success = true })
end

log("info", "cs-weekly-drop backend loaded")
