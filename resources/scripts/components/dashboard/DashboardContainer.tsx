import React, { useEffect, useState } from 'react';
import Input from '@/components/elements/Input';
import { Server } from '@/api/server/getServer';
import getServers from '@/api/getServers';
import Select from '@/components/elements/Select';
import ServerRow from '@/components/dashboard/ServerRow';
import Spinner from '@/components/elements/Spinner';
import PageContentBlock from '@/components/elements/PageContentBlock';
import useFlash from '@/plugins/useFlash';
import { useStoreState } from 'easy-peasy';
import { usePersistedState } from '@/plugins/usePersistedState';
import Switch from '@/components/elements/Switch';
import tw from 'twin.macro';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import Pagination from '@/components/elements/Pagination';
import { useLocation } from 'react-router-dom';

export default () => {
    const { search } = useLocation();
    const defaultPage = Number(new URLSearchParams(search).get('page') || '1');

    const [page, setPage] = useState(!isNaN(defaultPage) && defaultPage > 0 ? defaultPage : 1);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const uuid = useStoreState((state) => state.user.data!.uuid);
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [showOnlyAdmin, setShowOnlyAdmin] = usePersistedState(`${uuid}:show_all_servers`, false);

    const { data: servers, error } = useSWR<PaginatedResult<Server>>(
        ['/api/client/servers', showOnlyAdmin && rootAdmin, page],
        () => getServers({ page, type: showOnlyAdmin && rootAdmin ? 'admin' : undefined })
    );

    const [sort, setSort] = useState(0);
    const [desc, setDesc] = useState(false);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        const sortOrder = window.localStorage.getItem('SORT_ORDER');
        if (sortOrder !== null) setSort(JSON.parse(sortOrder));

        const sortDesc = window.localStorage.getItem('SORT_DESC');
        if (sortDesc !== null) setDesc(JSON.parse(sortDesc));
    }, []);

    useEffect(() => {
        window.localStorage.setItem('SORT_ORDER', JSON.stringify(sort));
        window.localStorage.setItem('SORT_DESC', JSON.stringify(desc));
    }, [sort, desc]);

    const specialSortFunction = (a: string, b: string): number => {
        a = a.replace(/\d+/g, (match) => String.fromCodePoint(parseInt(match)));
        b = b.replace(/\d+/g, (match) => String.fromCodePoint(parseInt(match)));
        return a > b ? 1 : a < b ? -1 : 0;
    };

    useEffect(() => {
        if (!servers) return;
        if (servers.pagination.currentPage > 1 && !servers.items.length) {
            setPage(1);
        }
    }, [servers?.pagination.currentPage]);

    useEffect(() => {
        // Don't use react-router to handle changing this part of the URL, otherwise it
        // triggers a needless re-render. We just want to track this in the URL incase the
        // user refreshes the page.
        window.history.replaceState(null, document.title, `/${page <= 1 ? '' : `?page=${page}`}`);
    }, [page]);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'dashboard', error });
        if (!error) clearFlashes('dashboard');
    }, [error]);

    return (
        <PageContentBlock title={'Dashboard'} showFlashKey={'dashboard'}>
            {rootAdmin && (
                <>
                    <div css={tw`mb-2 flex justify-end items-center`}>
                        <p css={tw`uppercase text-xs text-neutral-400 mr-2`}>
                            {showOnlyAdmin ? "Showing others' servers" : 'Showing your servers'}
                        </p>
                        <Switch
                            name={'show_all_servers'}
                            defaultChecked={showOnlyAdmin}
                            onChange={() => setShowOnlyAdmin((s) => !s)}
                        />
                    </div>
                    <div css={tw`mb-5 flex justify-start items-center`}>
                        <Input
                            css={tw`mx-1`}
                            placeholder={'Filter by name'}
                            value={filter}
                            onChange={(e) => setFilter(e.currentTarget.value)}
                        />
                        <div css={tw`mx-1`}>
                            <Select
                                css={tw`mr-4`}
                                value={sort}
                                onChange={(e) => setSort(Number(e.currentTarget.value))}
                            >
                                <option value='0'>Alphabetically</option>
                                <option value='1'>By Age</option>
                                <option value='2'>By Node</option>
                            </Select>
                        </div>
                        <div css={tw`mx-1`}>
                            <Select
                                css={tw`mr-4`}
                                value={desc ? 1 : 0}
                                onChange={(e) => setDesc(e.currentTarget.value === '1')}
                            >
                                <option value='0'>Ascending</option>
                                <option value='1'>Descending</option>
                            </Select>
                        </div>
                    </div>
                </>
            )}
            {!servers ? (
                <Spinner centered size={'large'} />
            ) : (
                <Pagination data={servers} onPageSelect={setPage}>
                    {({ items }) =>
                        items.length > 0 ? (
                            (() => {
                                const list = (() => {
                                    switch (sort) {
                                        default:
                                        case 0:
                                            return items.sort((a, b) => specialSortFunction(a.name, b.name));
                                        case 1:
                                            return items;
                                        case 2:
                                            return items
                                                .sort((a, b) => specialSortFunction(a.name, b.name))
                                                .sort((a, b) => specialSortFunction(a.node, b.node));
                                    }
                                })();
                                return desc ? list.slice().reverse() : list; // Slice to copy array, else reverse() will reverse the original array.
                            })()
                                .filter((server) => {
                                    return server.name.toLowerCase().includes(filter.toLowerCase());
                                })
                                .map((server, index) => (
                                    <ServerRow
                                        key={server.uuid}
                                        server={server}
                                        css={index > 0 ? tw`mt-2` : undefined}
                                    />
                                ))
                        ) : (
                            <p css={tw`text-center text-sm text-neutral-400`}>
                                {showOnlyAdmin
                                    ? 'There are no other servers to display.'
                                    : 'There are no servers associated with your account.'}
                            </p>
                        )
                    }
                </Pagination>
            )}
        </PageContentBlock>
    );
};
