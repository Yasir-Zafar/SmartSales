export async function getCurrentUserProfile(req, res) {
    res.json({ user: req.user });
}